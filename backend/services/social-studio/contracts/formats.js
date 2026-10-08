const SOCIAL_FORMATS = Object.freeze({
  feed_portrait: {id:'feed_portrait',name:'Instagram Feed 4:5',width:1080,height:1350},
  square: {id:'square',name:'Instagram/Facebook quadrado',width:1080,height:1080},
  story: {id:'story',name:'Instagram Stories',width:1080,height:1920},
});
const formatById=id=>SOCIAL_FORMATS[id] || SOCIAL_FORMATS.feed_portrait;
module.exports={SOCIAL_FORMATS,formatById};
