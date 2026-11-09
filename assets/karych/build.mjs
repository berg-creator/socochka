// Сборка моделей Карыча: gltf → glb, лишние клипы и узлы прочь, сжатие (resample, quantize, meshopt)
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup, prune, resample, quantize, meshopt, weld} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
const [src, dst, keep] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
const doc = await io.read(src);
const clips = keep ? keep.split(',') : [];
for (const a of doc.getRoot().listAnimations()) if (!clips.includes(a.getName())) { a.listChannels().forEach(c => c.dispose()); a.listSamplers().forEach(s => { s.dispose(); }); a.dispose(); }
await doc.transform(dedup(), weld(), resample({tolerance: 1e-4}), prune(), quantize({quantizePosition: 14, quantizeNormal: 10}), meshopt({encoder: MeshoptEncoder, level: 'medium'}));
await io.write(dst, doc);
