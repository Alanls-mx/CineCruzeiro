const {exportAnimation}=require('./animation');
async function createMotionPreview(scene,options={}) {
  const result=await exportAnimation(scene,{...scene.sourceDraft?.animation,format:'mp4',quality:'preview'},options);
  return {width:result.plan.width,height:Math.round(result.plan.width*scene.height/scene.width/2)*2,motionSpec:result.plan.motionSpec,contentType:result.contentType,src:`data:${result.contentType};base64,${result.buffer.toString('base64')}`};
}
module.exports={createMotionPreview};
