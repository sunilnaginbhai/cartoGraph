import { readParserResult } from '../parser/result.ts';
import { fold } from './folding.ts';
const result = await readParserResult(process.argv[2] ?? 'app/preview/analysis.json');
const graph = fold(result.files,result.edges);
const singles=graph.modules.filter(m=>m.files.length<2).length;
const missing=result.edges.filter(e=>!graph.owner.has(e.source)||!graph.owner.has(e.target)).length;
console.log({files:result.files.length,nodes:graph.modules.length,threshold:graph.threshold,singletons:singles,missingEndpoints:missing});
if(singles||missing||graph.modules.length>24) throw new Error('Graph invariants failed');
