import React from 'react';
import {AbsoluteFill,Composition,Img,registerRoot,useCurrentFrame,useVideoConfig} from 'remotion';
import {frameState} from './timeline';

export function Campaign({layers,spec,backgroundColor}) {
  const frame=useCurrentFrame(),{fps}=useVideoConfig(),time=frame/fps;
  return <AbsoluteFill style={{backgroundColor,overflow:'hidden'}}>
    {layers.map(layer=>{
      const track=spec.tracks.find(item=>item.id===layer.id),state=frameState(track,time,spec);
      const edge=track.revealAxis==='x'?track.bounds.x+track.bounds.width*state.reveal:track.bounds.y+track.bounds.height*state.reveal;
      const clip=track.revealAxis==='x'?`polygon(0 0,${edge}px 0,${edge}px 100%,0 100%)`:`polygon(0 0,100% 0,100% ${edge}px,0 ${edge}px)`;
      return <AbsoluteFill key={layer.id} style={{opacity:state.opacity,transformOrigin:`${track.originX}px ${track.originY}px`,transform:`translate(${state.x}px,${state.y}px) scale(${state.scale})`,filter:`brightness(${state.brightness+state.light})`,clipPath:state.reveal<1?clip:undefined}}><Img src={layer.src} style={{width:'100%',height:'100%'}} /></AbsoluteFill>;
    })}
  </AbsoluteFill>;
}
function Root(){return <Composition id="SocialCampaign" component={Campaign} width={1080} height={1350} fps={24} durationInFrames={192} defaultProps={{layers:[],spec:{tracks:[],duration:8},backgroundColor:'#000000'}} calculateMetadata={({props})=>({width:props.width,height:props.height,durationInFrames:Math.ceil(props.spec.duration*24),fps:24})}/>;}
registerRoot(Root);
