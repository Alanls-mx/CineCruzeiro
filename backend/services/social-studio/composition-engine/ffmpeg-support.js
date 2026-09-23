const {spawn}=require('child_process');
function runEncoder(args,options={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.SOCIAL_STUDIO_FFMPEG || 'ffmpeg',['-hide_banner','-loglevel','error','-threads','1',...args],{windowsHide:true,stdio:['ignore','ignore','pipe'],signal:options.signal});
    let stderr='';child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-2000);});
    const timer=setTimeout(()=>child.kill('SIGKILL'),180000);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Object.assign(new Error('Não foi possível codificar a animação. Tente novamente.'),{cause:new Error(stderr)}));});
  });
}
module.exports={runEncoder};
