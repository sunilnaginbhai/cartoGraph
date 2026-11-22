"use client";

import { useMemo, useState, useEffect } from 'react';
import { ReactFlow, ReactFlowProvider, Handle, Position, Controls, useReactFlow, type Node, type NodeProps, type Edge } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import type { ParserResult } from '../../parser/types';
import { fold } from '../../graph/folding';
import styles from './dependency-map.module.css';

type Module = ReturnType<typeof fold>['modules'][number];
type Data = { module: Module; open: boolean; toggle: () => void; select: (path: string) => void; active: string | null };
type ModuleNode = Node<Data, 'module'>;
function Folder({ data }: NodeProps<ModuleNode>) {
  return <div className={styles.folder}>
    <Handle type="target" position={Position.Left} id="in" />
    <button className={styles.header} onClick={data.toggle} aria-expanded={data.open} title={data.module.id}>
      <strong>{data.module.label}</strong>
      <span>{data.module.files.length} files · in {data.module.fanIn} · out {data.module.fanOut}</span>
    </button>
    {data.open && data.module.files.slice(0,12).map(file => <div className={styles.row} key={file.path}>
      <Handle type="target" position={Position.Left} id={'in:'+file.path} />
      <button className="nodrag" aria-pressed={data.active===file.path} title={file.path} onClick={()=>data.select(file.path)}>{file.path.slice(data.module.id === '.' ? 0 : data.module.id.length+1)}</button>
      <Handle type="source" position={Position.Right} id={'out:'+file.path} />
    </div>)}
    {data.open && data.module.files.length>12 && <div className={styles.row}><Handle type="target" position={Position.Left} id="in:more" /><span>{data.module.files.length-12} more files</span><Handle type="source" position={Position.Right} id="out:more" /></div>}
    <Handle type="source" position={Position.Right} id="out" />
  </div>;
}
const nodeTypes = { module: Folder };
function Canvas({ result }: { result: ParserResult }) {
  const folded = useMemo(()=>fold(result.files,result.edges),[result]);
  const [opened,setOpened]=useState<Set<string>>(new Set());
  const [selection,setSelection]=useState<string|null>(null);
  const flow=useReactFlow<ModuleNode>();
  const {nodes,edges}=useMemo(()=>{
    const related=new Set<string>();
    const selectedFiles=new Set(selection ? (folded.modules.find(m=>m.id===selection)?.files.map(f=>f.path) ?? [selection]) : []);
    const visibleEdges=result.edges.filter(e=>!selection || selectedFiles.has(e.source)||selectedFiles.has(e.target));
    for(const e of visibleEdges) {related.add(e.source);related.add(e.target);}
    for(const p of selectedFiles) related.add(p);
    const nodes: ModuleNode[]=folded.modules.map(module=>({id:module.id,type:'module',position:{x:0,y:0},data:{module,open:opened.has(module.id),active:selection,toggle:()=>{setOpened(previous=>{const next=new Set(previous);if(next.has(module.id))next.delete(module.id);else next.add(module.id);return next;});setSelection(module.id);},select:setSelection},style:{width:Math.max(210,module.label.length*8+32),height:opened.has(module.id)?64+Math.min(13,module.files.length)*26:64+Math.sqrt(module.fanIn)*12,opacity:selection&&!module.files.some(f=>related.has(f.path))?0.18:1}}));
    const handle=(id:string,path:string,prefix:string)=>{if(!opened.has(id))return prefix;const group=folded.modules.find(m=>m.id===id);return prefix+':'+(group?.files.slice(0,12).some(f=>f.path===path)?path:'more');};
    const edges: Edge[]=result.edges.flatMap((e,index)=>{const source=folded.owner.get(e.source);const target=folded.owner.get(e.target);if(!source||!target||source===target&&!opened.has(source))return [];return [{id:String(index),source,target,sourceHandle:handle(source,e.source,'out'),targetHandle:handle(target,e.target,'in'),style:{stroke:'#697585',strokeWidth:1,opacity:selection&&!selectedFiles.has(e.source)&&!selectedFiles.has(e.target)?0.06:0.65}}];});
    const graph=new dagre.graphlib.Graph().setGraph({rankdir:'LR',nodesep:36,ranksep:100}).setDefaultEdgeLabel(()=>({}));
    for(const n of nodes) graph.setNode(n.id,{width:Number(n.style?.width),height:Number(n.style?.height)});
    for(const e of edges) if(e.source!==e.target)graph.setEdge(e.source,e.target);
    dagre.layout(graph);
    for(const n of nodes){const p=graph.node(n.id);n.position={x:p.x-p.width/2,y:p.y-p.height/2};}
    return {nodes,edges};
  },[folded,opened,selection,result]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{void flow.fitView({nodes,padding:0.12,maxZoom:Math.min(1,flow.getZoom()),duration:0});});return ()=>cancelAnimationFrame(frame);},[opened,flow,nodes]);
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.03} maxZoom={2} nodesDraggable={false} nodesConnectable={false} onPaneClick={()=>setSelection(null)}><Controls showInteractive={false} /></ReactFlow>;
}
export function DependencyMap({result}:{result:ParserResult}) {return <ReactFlowProvider><Canvas result={result}/></ReactFlowProvider>;}
