const path=require('path');
const fs=require('fs/promises');
(async()=>{
  const root=path.resolve(__dirname,'..');
  await require('@remotion/bundler').bundle({entryPoint:path.join(root,'backend/services/social-studio/remotion/entry.jsx'),outDir:path.join(root,'.remotion'),publicDir:null,onProgress:()=>{}});
  if(process.argv.includes('--browser')) {
    const browser=await require('@remotion/renderer').ensureBrowser();
    await fs.writeFile(path.join(root,'.remotion/browser.json'),JSON.stringify(browser));
    await require('@remotion/renderer').selectComposition({serveUrl:path.join(root,'.remotion'),id:'SocialCampaign',browserExecutable:browser.path || null,inputProps:{width:320,height:320,layers:[],spec:{duration:5,tracks:[]},backgroundColor:'#000000'},logLevel:'error'});
  }
  console.log('Social Studio motion bundle pronto.');
})().catch(error=>{console.error(error);process.exitCode=1;});
