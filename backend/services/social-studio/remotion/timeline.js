const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const ease=value=>1-Math.pow(1-clamp(value),3);

// Both Remotion and the FFmpeg fallback evaluate this exact timeline.
function frameState(track,time,spec) {
  const enter=ease((time-track.start)/track.fade);
  const exit=track.end<spec.duration?1-ease((time-track.end+track.fade)/track.fade):1;
  const settle=ease((time-track.start)/Math.max(.1,spec.readableFrom-track.start));
  const ambient=1-ease(time/Math.max(1,spec.readableFrom));
  let opacity=enter*exit;
  let cycleScale=0,cycleDarken=0;
  if(track.cycle) {
    const active=ease((time-track.cycle.start)/.45)*(1-ease((time-track.cycle.end-.45)/.45));
    const summary=ease((time-spec.summaryStart)/.65);
    opacity=spec.preset==='crossfade-program'?Math.max(active,summary):Math.max(.25,active,summary)*enter;
    if(spec.preset==='spotlight') cycleDarken=(1-active)*.65*(1-summary);
    if(spec.preset==='featured-cycle') cycleScale=active*.04*(1-summary);
  }
  return {
    opacity:clamp(opacity),
    x:(track.x || 0)*(1-enter)+(track.driftX || 0)*ambient,
    y:(track.y || 0)*(1-enter)+(track.driftY || 0)*ambient,
    scale:1+(track.scale || 0)*(1-settle)+cycleScale+(track.pop?Math.sin(Math.PI*clamp((time-track.start)/.85))*.13*(1-settle):0),
    brightness:1-(track.darken || 0)*(1-settle)-cycleDarken,
    reveal:track.reveal?enter:1,
    light:track.light && time<spec.readableFrom?Math.sin(Math.PI*clamp((time-track.start)/Math.max(.1,spec.readableFrom-track.start)))*track.light:0
  };
}
module.exports={frameState};
