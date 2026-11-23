"use client";

import { createContext, useContext, useMemo, useState, useEffect, useRef } from 'react';
import { ReactFlow, ReactFlowProvider, Handle, Position, Controls, Panel, useReactFlow, type Node, type NodeProps, type Edge } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import type { ParserResult } from '../../parser/types';
import { fold } from '../../graph/folding';
import { buildRepositoryDetails } from '../../graph/details';
import { DetailPane } from './detail-pane';
import shellStyles from './canvas-shell.module.css';
import styles from './dependency-map.module.css';

type Module = ReturnType<typeof fold>['modules'][number];
type Data = { module: Module; open: boolean; toggle: () => void; select: (path: string) => void; hover: (path: string | null) => void; active: string | null; brightFiles: Set<string>; incomingFiles: Set<string>; outgoingFiles: Set<string>; searchMatches: Set<string>; connected: boolean; category: string | null };
type ModuleNode = Node<Data, 'module'>;
const PaneHover = createContext<string | null>(null);
function Folder({ data }: NodeProps<ModuleNode>) {
  const paneHover = useContext(PaneHover);
  const list = useRef<HTMLDivElement>(null);
  const selectedRow = useRef<HTMLDivElement>(null);
  const hovered = paneHover !== null && data.module.files.some(file => file.path === paneHover);
  const categoryMatches = data.category === null ? data.module.files.length : data.module.files.filter(file => file.extension === data.category).length;

  useEffect(() => {
    const container = list.current;
    const row = selectedRow.current;
    if (!container || !row) return;
    if (row.offsetTop < container.scrollTop) container.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = row.offsetTop + row.offsetHeight - container.clientHeight;
    }
  }, [data.active, data.open]);

  return <div className={styles.folder} onClick={()=>data.select(data.module.id)} data-selected={data.active===data.module.id || data.module.files.some(file=>file.path===data.active)} data-connected={data.connected}
    data-pane-hover={hovered}
    onMouseEnter={() => data.hover(data.module.id)}
    onMouseLeave={() => data.hover(null)}>
    <Handle type="target" position={Position.Left} id="in" />
    <button className={styles.header} onClick={event=>{event.stopPropagation();data.toggle();}} aria-expanded={data.open} title={data.module.id}>
      <strong>{data.module.label}</strong>
      <span>{data.category === null ? `${data.module.files.length} files` : `${categoryMatches} of ${data.module.files.length} match`} · in {data.module.fanIn} · out {data.module.fanOut}</span>
    </button>
    {data.open && <div ref={list} className={`${styles.fileList} nopan nowheel`}>
      {data.module.files.map(file => {
        const selected=data.active===file.path;
        const direction=selected?'selected':data.incomingFiles.has(file.path)?'incoming':data.outgoingFiles.has(file.path)?'outgoing':undefined;
        const rowHovered = paneHover === file.path;
        return <div className={styles.row} key={file.path} ref={selected ? selectedRow : undefined}
          data-direction={direction}
          data-pane-hover={rowHovered}
          data-search-match={data.searchMatches.has(file.path)}
          style={{ opacity: data.category !== null && file.extension !== data.category ? 0.15 : rowHovered || !data.active || data.brightFiles.has(file.path) ? 1 : 0.15 }}
          onMouseEnter={() => data.hover(file.path)}
          onMouseLeave={event => {
            const next = event.relatedTarget;
            data.hover(next instanceof Node && list.current?.parentElement?.contains(next) ? data.module.id : null);
          }}>
          <Handle type="target" position={Position.Left} id={'in:'+file.path} />
          <button className="nodrag" aria-pressed={selected} title={file.path} onClick={event=>{event.stopPropagation();data.select(file.path);}}>{file.path.slice(data.module.id === '.' ? 0 : data.module.id.length+1)}</button>
          <Handle type="source" position={Position.Right} id={'out:'+file.path} />
        </div>;
      })}
    </div>}
    <Handle type="source" position={Position.Right} id="out" />
  </div>;
}
const nodeTypes = { module: Folder };
type MapProps = { result: ParserResult; repository: string; category: string | null };

function Canvas({ result, repository, category }: MapProps) {
  const folded = useMemo(()=>fold(result.files,result.edges),[result]);
  const details = useMemo(() => buildRepositoryDetails(result), [result]);
  const folders = useMemo(() => new Map(folded.modules.map(folder => [folder.id, folder])), [folded]);
  const [opened,setOpened]=useState<Set<string>>(new Set());
  const [selection,setSelection]=useState<string|null>(null);
  const [mapHover, setMapHover] = useState<string | null>(null);
  const [paneHover, setPaneHover] = useState<string | null>(null);
  const [search,setSearch]=useState('');
  const searchRef=useRef<HTMLInputElement>(null);
  const flow=useReactFlow<ModuleNode>();
  const {nodes,edges}=useMemo(()=>{
    const related=new Set<string>();
    const selectedFiles=new Set(selection ? (folded.modules.find(m=>m.id===selection)?.files.map(f=>f.path) ?? [selection]) : []);
    const incomingFiles=new Set<string>();
    const outgoingFiles=new Set<string>();
    const searchMatches=new Set<string>();
    const query=search.trim().toLowerCase();
    if(query) for(const file of folded.modules.flatMap(module=>module.files)) if(file.path.toLowerCase().includes(query)) searchMatches.add(file.path);
    const visibleEdges=result.edges;
    for(const p of selectedFiles) related.add(p);
    for(const e of visibleEdges) {
      if(selection && (selectedFiles.has(e.source)||selectedFiles.has(e.target))) {
        if(selectedFiles.has(e.target)) { incomingFiles.add(e.source); related.add(e.source); }
        if(selectedFiles.has(e.source)) { outgoingFiles.add(e.target); related.add(e.target); }
      }
    }
    const nodes: ModuleNode[]=folded.modules.map(module=>{const connected=(!selection||module.files.some(file=>related.has(file.path)))&&(category===null||module.files.some(file=>file.extension===category));return {id:module.id,type:'module',position:{x:0,y:0},zIndex:10,data:{module,open:opened.has(module.id),active:selection,brightFiles:related,incomingFiles,outgoingFiles,searchMatches,connected,category,hover:setMapHover,toggle:()=>{setOpened(previous=>{const next=new Set(previous);if(next.has(module.id))next.delete(module.id);else next.add(module.id);return next;});setSelection(module.id);},select:setSelection},style:{width:Math.max(240,module.label.length*8+48),height:opened.has(module.id)?364:64+Math.sqrt(module.fanIn)*12}};});
    const folderEdges=new Map<string,{source:string;target:string;direct:boolean;incoming:boolean}>();
    for(const edge of result.edges){
      const source=folded.owner.get(edge.source);
      const target=folded.owner.get(edge.target);
      if(!source||!target||source===target)continue;
      const key=source<target?`${source}\u0001${target}`:`${target}\u0001${source}`;
      const direct=Boolean(selection&&(selectedFiles.has(edge.source)||selectedFiles.has(edge.target)));
      const incoming=Boolean(selection&&selectedFiles.has(edge.target));
      const existing=folderEdges.get(key);
      if(existing){
        existing.direct ||= direct;
        existing.incoming ||= incoming;
      }else{
        folderEdges.set(key,{source,target,direct,incoming});
      }
    }
    const edges: Edge[]=[...folderEdges.entries()].map(([key,pair],index)=>({
      id:key,
      source:pair.source,
      target:pair.target,
      sourceHandle:'out',
      targetHandle:'in',
      zIndex:pair.direct?2:1,
      style:{
        stroke:pair.direct?(pair.incoming?'#87b6a1':'#c4aa80'):(selection?'#3d423f':'#b5beb9'),
        strokeWidth:pair.direct?2.5:0.65,
        opacity:category !== null ? 0.12 : pair.direct?1:(selection?0.08:0.9),
      },
      data:{index},
    }));
    const graph=new dagre.graphlib.Graph().setGraph({rankdir:'LR',nodesep:36,ranksep:100}).setDefaultEdgeLabel(()=>({}));
    for(const n of nodes) graph.setNode(n.id,{width:Number(n.style?.width),height:Number(n.style?.height)});
    for(const e of edges) if(e.source!==e.target)graph.setEdge(e.source,e.target);
    dagre.layout(graph);
    for(const n of nodes){const p=graph.node(n.id);n.position={x:p.x-p.width/2,y:p.y-p.height/2};}
    return {nodes,edges};
  },[category,folded,opened,search,selection,result]);
  const fittedExpansion = useRef<Set<string> | null>(null);
  useEffect(()=>{
    // Selection only changes emphasis, never the user's viewport.
    if(fittedExpansion.current===opened)return;
    const frame=requestAnimationFrame(()=>{fittedExpansion.current=opened;void flow.fitView({nodes,padding:0.12,maxZoom:Math.min(1,flow.getZoom()),duration:0});});
    return ()=>cancelAnimationFrame(frame);
  },[opened,flow,nodes]);
  useEffect(()=>{
    const clear=(event:KeyboardEvent)=>{if(event.key==='Escape')setSelection(null);};
    const focusSearch=(event:KeyboardEvent)=>{
      if(event.key==='/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)){
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown',clear);
    window.addEventListener('keydown',focusSearch);
    return ()=>{
      window.removeEventListener('keydown',clear);
      window.removeEventListener('keydown',focusSearch);
    };
  },[]);
  useEffect(()=>{
    if(selection===null)return;
    const owner=folded.owner.get(selection);
    if(owner===undefined||!opened.has(owner))return;
    const frame=requestAnimationFrame(()=>{
      const node=nodes.find(candidate=>candidate.id===owner);
      if(!node)return;
      void flow.setCenter(
        node.position.x+Number(node.style?.width)/2,
        node.position.y+Number(node.style?.height)/2,
        {zoom:flow.getZoom()},
      );
    });
    return ()=>cancelAnimationFrame(frame);
  },[selection,opened,folded.owner,nodes,flow]);
  const handleSearch=(value:string)=>{
    setSearch(value);
    const query=value.trim().toLowerCase();
    if(!query)return;
    setOpened(previous=>{
      const next=new Set(previous);
      for(const folderModule of folded.modules) {
        if(folderModule.files.some(file=>file.path.toLowerCase().includes(query))) next.add(folderModule.id);
      }
      return next;
    });
  };
  const handleNodeClick = (_event: React.MouseEvent, node: ModuleNode) => {
    setSelection(node.id);
    if (!opened.has(node.id)) {
      setOpened(previous => {
        const next = new Set(previous);
        next.add(node.id);
        return next;
      });
    }
  };
  const collapseAll=()=>{
    setOpened(new Set());
    setSelection(null);
  };
  const expandAll=()=>{
    setOpened(new Set(folded.modules.map(folder=>folder.id)));
  };
  const fitCanvas=()=>{
    void flow.fitView({nodes,padding:0.12,maxZoom:1,duration:240});
  };
  const connectionCount=selection?result.edges.filter(edge=>edge.source===selection||edge.target===selection).length:0;
  const selectionLabel=selection ?? 'No file selected';
  function selectPaneFile(path: string) {
    const owner = folded.owner.get(path);
    if (owner === undefined) return;
    setPaneHover(null);
    setSelection(path);
    if (!opened.has(owner)) {
      setOpened(previous => new Set(previous).add(owner));
      return;
    }
    const node = nodes.find(candidate => candidate.id === owner);
    if (node) {
      void flow.setCenter(
        node.position.x + Number(node.style?.width) / 2,
        node.position.y + Number(node.style?.height) / 2,
        { zoom: flow.getZoom() },
      );
    }
  }

  return <>
  <main aria-label="Map" className={shellStyles.stage}>
  <PaneHover.Provider value={paneHover}>
  <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.03} maxZoom={2} nodesDraggable={false} nodesConnectable={false} onNodeClick={handleNodeClick} onPaneClick={()=>setSelection(null)}>
    <Panel position="top-left" className={styles.canvasToolbar}>
      <label className={styles.searchBox}>
        <span aria-hidden="true">/</span>
        <input ref={searchRef} value={search} onChange={event=>handleSearch(event.target.value)} placeholder="Find a file" aria-label="Find a file" />
        {search && <button type="button" className={styles.searchClear} onClick={()=>handleSearch('')} aria-label="Clear file search">×</button>}
      </label>
      <button type="button" className={styles.canvasAction} onClick={fitCanvas} title="Fit map to screen">Fit</button>
      <button type="button" className={styles.canvasAction} onClick={expandAll} title="Expand every folder">Expand all</button>
      <button type="button" className={styles.canvasAction} onClick={collapseAll} title="Collapse all folders">Collapse</button>
      {selection && <button type="button" className={styles.clearSelection} onClick={()=>setSelection(null)}>Clear selection</button>}
    </Panel>
    <Panel position="top-right" className={styles.canvasLegend}>
      <span><i data-kind="incoming" />Incoming</span>
      <span><i data-kind="outgoing" />Outgoing</span>
      <span><i data-kind="selected" />Selected</span>
    </Panel>
    <Panel position="bottom-left" className={styles.canvasStatus}>
      <strong>{selectionLabel}</strong>
      {selection && <span>{connectionCount} direct connections</span>}
    </Panel>
    <Controls showInteractive={false} />
  </ReactFlow>
  </PaneHover.Provider>
  </main>
  <DetailPane
    className={shellStyles.detail}
    repository={repository}
    result={result}
    details={details}
    selection={selection}
    folders={folders}
    mapHover={mapHover}
    owners={folded.owner}
    onFileSelect={selectPaneFile}
    onFileHover={setPaneHover}
  />
  </>;
}
export function DependencyMap(props: MapProps) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
