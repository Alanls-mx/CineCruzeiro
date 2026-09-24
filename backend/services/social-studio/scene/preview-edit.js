const {renderSocialScene} = require('./renderer');
function editableSnapshot(original, scene) {
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
module.exports = {editableSnapshot, renderPreviewEdit};
