// @ts-ignore
import { pipeline, env } from '@xenova/transformers';

// Configure environment
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/';

let transcriber: any = null;
let translator: any = null;
let currentModelSize: string | null = null;
let currentLoadingStep = 'transcribe_load';
let lastProgressTime = 0;
let lastModelProgressTime = 0;
let lastTransProgressTime = 0;

// Custom fetch with retry and chunking logic
async function fetchWithRetry(url: string, options: any, retries = 3, timeoutMs = 15000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok || res.status === 206 || res.status === 404) return res;
            if (i === retries - 1) return res;
        } catch (err) {
            clearTimeout(timeoutId);
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, 1500 * (i + 1))); 
        }
    }
    throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

async function chunkedFetch(url: string, options: any): Promise<Response> {
    if (!url.match(/\.(onnx|bin|msgpack|safetensors)$/i)) {
        return fetchWithRetry(url, options);
    }

    try {
        const headRes = await fetchWithRetry(url, { ...options, method: 'HEAD' });
        if (!headRes || !headRes.ok) return fetchWithRetry(url, options);

        const contentLength = parseInt(headRes.headers.get('content-length') || '0', 10);
        const acceptRanges = headRes.headers.get('accept-ranges');

        if (acceptRanges !== 'bytes' || !contentLength || contentLength < 5 * 1024 * 1024) {
            return fetchWithRetry(url, options);
        }

        // @ts-ignore
        const numChunks = self.customNumChunks || 16; 
        const chunkSize = Math.ceil(contentLength / numChunks);
        const assembledChunks: any[] = [];
        let fileLoaded = 0;

        const maxConcurrency = 4;
        
        for (let i = 0; i < numChunks; i += maxConcurrency) {
            const batchPromises = [];
            for (let j = i; j < i + maxConcurrency && j < numChunks; j++) {
                const start = j * chunkSize;
                const end = j === numChunks - 1 ? contentLength - 1 : (j + 1) * chunkSize - 1;

                const chunkPromise = fetchWithRetry(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Range': `bytes=${start}-${end}`
                    }
                }).then(async res => {
                    if (!res || !res.body) throw new Error('No response body');
                    const reader = res.body.getReader();
                    const chunks = [];
                    let chunkBytes = 0;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                        chunkBytes += value.length;
                        fileLoaded += value.length;
                        
                        const now = Date.now();
                        if (now - lastProgressTime > 100) {
                            self.postMessage({
                                type: 'progress',
                                step: currentLoadingStep,
                                data: { status: 'progress', file: url, loaded: fileLoaded, total: contentLength }
                            });
                            lastProgressTime = now;
                        }
                    }
                    
                    self.postMessage({
                        type: 'progress',
                        step: currentLoadingStep,
                        data: { status: 'done', file: url, loaded: fileLoaded, total: contentLength }
                    });

                    const assembledChunk = new Uint8Array(chunkBytes);
                    let offset = 0;
                    for (const c of chunks) {
                        assembledChunk.set(c, offset);
                        offset += c.length;
                    }
                    return { index: j, buffer: assembledChunk };
                });
                batchPromises.push(chunkPromise);
            }
            
            const batchResults = await Promise.all(batchPromises);
            assembledChunks.push(...batchResults);
        }

        assembledChunks.sort((a, b) => a.index - b.index);

        const finalBuffer = new Uint8Array(contentLength);
        let globalOffset = 0;
        for (const chunk of assembledChunks) {
            finalBuffer.set(chunk.buffer, globalOffset);
            globalOffset += chunk.buffer.byteLength;
        }

        return new Response(finalBuffer, {
            status: 200,
            headers: new Headers({
                'Content-Length': contentLength.toString(),
                'Content-Type': headRes.headers.get('content-type') || 'application/octet-stream'
            })
        });

    } catch (e) {
        console.warn("Chunked fetch failed, falling back to standard fetch:", e);
        return fetchWithRetry(url, options);
    }
}

// @ts-ignore
env.customFetch = chunkedFetch;

self.onmessage = async (e) => {
    const { type, data } = e.data;

    if (type === 'detect_language') {
        // @ts-ignore
        self.customNumChunks = 16;
        try {
            currentLoadingStep = 'transcribe_load';
            // @ts-ignore
            let device = (data.useWebGPU && navigator.gpu) ? 'webgpu' : 'wasm';
            
            if (!transcriber || currentModelSize !== data.modelSize) {
                if (transcriber && typeof transcriber.dispose === 'function') await transcriber.dispose();
                currentModelSize = data.modelSize;
                try {
                    transcriber = await (pipeline as any)('automatic-speech-recognition', data.modelSize, {
                        device: device,
                        progress_callback: (prog: any) => {
                            const now = Date.now();
                            if (now - lastModelProgressTime > 100 || prog.status === 'done') {
                                self.postMessage({ type: 'progress', step: 'transcribe_load', data: prog });
                                lastModelProgressTime = now;
                            }
                        }
                    });
                } catch(err) {
                    if(device === 'webgpu') {
                        self.postMessage({ type: 'status', text: 'WebGPU failed, falling back to CPU...' });
                        transcriber = await (pipeline as any)('automatic-speech-recognition', data.modelSize, {
                            device: 'wasm',
                            progress_callback: (prog: any) => {
                                const now = Date.now();
                                if (now - lastModelProgressTime > 100 || prog.status === 'done') {
                                    self.postMessage({ type: 'progress', step: 'transcribe_load', data: prog });
                                    lastModelProgressTime = now;
                                }
                            }
                        });
                    } else throw err;
                }
            }
            
            const output = await transcriber(data.audioChunk, {
                task: 'transcribe',
                chunk_length_s: 30,
                return_timestamps: false
            });
            
            self.postMessage({ type: 'detect_complete', text: output.text });
        } catch(err: any) {
            self.postMessage({ type: 'detect_error', error: err.message });
        }
        return;
    }

    if (type === 'process') {
        // @ts-ignore
        self.customNumChunks = data.numChunks || 16;
        try {
            currentLoadingStep = 'transcribe_load';
            // @ts-ignore
            let device = (data.useWebGPU && navigator.gpu) ? 'webgpu' : 'wasm';

            if (!transcriber || currentModelSize !== data.modelSize) {
                if (transcriber && typeof transcriber.dispose === 'function') {
                    await transcriber.dispose();
                }
                currentModelSize = data.modelSize;
                
                try {
                    transcriber = await (pipeline as any)('automatic-speech-recognition', data.modelSize, {
                        device: device,
                        progress_callback: (prog: any) => {
                            const now = Date.now();
                            if (now - lastModelProgressTime > 100 || prog.status === 'done') {
                                self.postMessage({ type: 'progress', step: 'transcribe_load', data: prog });
                                lastModelProgressTime = now;
                            }
                        }
                    });
                } catch (err) {
                    if (device === 'webgpu') {
                        self.postMessage({ type: 'status', text: 'WebGPU acceleration not supported for this model. Falling back to WASM...' });
                        device = 'wasm';
                        transcriber = await (pipeline as any)('automatic-speech-recognition', data.modelSize, {
                            device: 'wasm',
                            progress_callback: (prog: any) => {
                                const now = Date.now();
                                if (now - lastModelProgressTime > 100 || prog.status === 'done') {
                                    self.postMessage({ type: 'progress', step: 'transcribe_load', data: prog });
                                    lastModelProgressTime = now;
                                }
                            }
                        });
                    } else {
                        throw err;
                    }
                }
            }

            self.postMessage({ type: 'status', text: 'Model ready! Processing audio...' });
            self.postMessage({ type: 'progress_percent', percent: 40 });

            let transcriberConfig: any = {
                task: 'transcribe',
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
            };
            
            if (data.sourceLang !== 'auto') {
                transcriberConfig.language = data.sourceLang;
            }

            const output = await transcriber(data.audioData, transcriberConfig);

            if (!output || !output.chunks || output.chunks.length === 0) {
                throw new Error('No clear speech detected in the file.');
            }

            if (data.needsTranslation) {
                self.postMessage({ type: 'status', text: 'Transcription complete! Preparing translation model...' });
                self.postMessage({ type: 'progress_percent', percent: 60 });
                
                if (!translator) {
                    translator = await pipeline('translation', 'Xenova/nllb-200-distilled-600M', {
                        quantized: true,
                        progress_callback: (prog: any) => {
                            const now = Date.now();
                            if (now - lastTransProgressTime > 100 || prog.status === 'done') {
                                self.postMessage({ type: 'progress', step: 'translate_load', data: prog });
                                lastTransProgressTime = now;
                            }
                        }
                    });
                }

                self.postMessage({ type: 'status', text: 'Translation model ready! Translating segments...' });
                
                const src_lang = data.nllbSrc;
                const tgt_lang = data.nllbTgt;

                for (let i = 0; i < output.chunks.length; i++) {
                    self.postMessage({ type: 'progress_percent', percent: 80 + Math.round((i / output.chunks.length) * 20) });
                    const translated = await translator(output.chunks[i].text, {
                        src_lang: src_lang,
                        tgt_lang: tgt_lang
                    });
                    if (translated && translated.length > 0) {
                        output.chunks[i].text = translated[0].translation_text;
                    }
                }
            }

            self.postMessage({ type: 'complete', chunks: output.chunks });

        } catch (err: any) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }
};
