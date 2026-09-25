const {renderSocialScene} = require('./renderer');
function editableSnapshot(original, scene) {
  if(!original?.scene)throw Object.assign(new Error('A cena original não está disponível. Abra a arte novamente no histórico.'),{statusCode:409});
  if (!scene || !Array.isArray(scene.elements) || scene.elements.length > 80) {
    throw Object.assign(new Error('Cena de edição inválida.'), {statusCode:400});
  }
  // The authenticated snapshot owns the commercial facts and publication format.
  return {...scene, templateId:original.scene.templateId, formatId:original.scene.formatId,
    width:original.scene.width, height:original.scene.height, sourceDraft:original.scene.sourceDraft};
}
async function renderPreviewEdit(original, scene, options) {
  const rendered = await renderSocialScene(editableSnapshot(original, scene), options);
  return {...original, ...rendered, draft:{...original.draft, outputType:rendered.outputType}};
}
function withCaption(rendered, caption) {
  if(typeof caption!=='string')return rendered;
  return {...rendered,draft:{...rendered.draft,caption:caption.trim().slice(0,1800)}};
}
module.exports = {editableSnapshot, renderPreviewEdit, withCaption};
