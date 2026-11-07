function createSocialStudioPublicProjectionService({ slugify }) {
  function publicSocialStudioPost(post = {}) {
    return {
      ...post,
      originalScene: undefined,
      draftScene: undefined,
      editedScene: undefined,
      sceneVersions: Array.isArray(post.sceneVersions)
        ? post.sceneVersions.map(({ scene, ...version }) => version)
        : [],
      editable: post.rendererVersion === "v2" || Boolean(post.originalScene),
      hasEditedScene: Boolean(post.editedScene),
      hasDraftScene: Boolean(post.draftScene)
    };
  }

  function socialStudioDownloadName(post = {}) {
    const title = slugify(post.title || post.templateName || "post") || "post";
    const extension = post.outputType === "jpg" ? "jpg" : "png";
    return `${title}-${post.formatId || "social"}.${extension}`;
  }

  return { publicSocialStudioPost, socialStudioDownloadName };
}

module.exports = { createSocialStudioPublicProjectionService };
