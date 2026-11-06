"use strict";

const crypto = require("crypto");
const sharp = require("sharp");

function createAdminSocialStudioRoutes({
  adminHasPermission,
  captionForDraft,
  createHistoryRecord,
  editableSceneForPost,
  generateSocialCampaign,
  getSocialStudioAutomationOrchestrator,
  loadSocialStudioImage,
  logEvent,
  normalizeSocialDraft,
  normalizeSocialScene,
  persistSocialStudioPosts,
  publicAssetUrl,
  publicSocialStudioPost,
  readBody,
  renderSocialPost,
  renderSocialScene,
  responseCorsOrigin,
  securityHeaders,
  sendJson,
  slugify,
  socialDraftNotices,
  socialStudioBrand,
  socialStudioContext,
  socialStudioDownloadName,
  storageService,
  SOCIAL_FORMATS,
}) {
  return async function handleAdminSocialStudioRoute({ req, res, pathname, method, db }) {
  if (pathname === "/api/admin/social-studio/context" && method === "GET") {
    const studioBrand=socialStudioBrand(db);
    const automation=await getSocialStudioAutomationOrchestrator().list({cinemaId:studioBrand.id || studioBrand.slug || studioBrand.name || '',limit:8});
    sendJson(res, 200, {
      ...socialStudioContext(db),
      automation:{enabled:Boolean(process.env.STUDIO_AUTOMATION_TOKEN || process.env.N8N_STUDIO_SHARED_SECRET),campaigns:automation},
      workspaceLayouts: require('./social-studio/contracts/workspace').LAYOUTS,
      capabilities: {
        view: adminHasPermission(req.adminUser, "social_studio.view"),
        create: adminHasPermission(req.adminUser, "social_studio.create"),
        delete: adminHasPermission(req.adminUser, "social_studio.delete")
      },
      engine: { version: "v2", renderer: "Satori + Sharp", deterministic: true }
    }, { "Cache-Control": "no-store" });
    return true;
  }

  if (pathname === "/api/admin/social-studio/automation/campaigns" && method === "GET") {
    sendJson(res,200,{campaigns:await getSocialStudioAutomationOrchestrator().list({limit:30})},{'Cache-Control':'no-store'});return true;
  }
  if (pathname === "/api/admin/social-studio/automation/campaigns" && method === "POST") {
    const body=await readBody(req);
    const campaign=await getSocialStudioAutomationOrchestrator().create({...body,source:'studio',triggerType:body.triggerType || 'manual'},{createdBy:req.adminUser.id});
    sendJson(res,campaign.duplicate?200:202,{campaign},{'Cache-Control':'no-store'});return true;
  }
  const adminAutomationMatch=pathname.match(/^\/api\/admin\/social-studio\/automation\/campaigns\/([a-f0-9-]{36})(?:\/(reprocess))?$/);
  if(adminAutomationMatch) {
    const [,campaignId,action]=adminAutomationMatch;
    if(action==='reprocess' && method==='POST'){sendJson(res,202,{campaign:await getSocialStudioAutomationOrchestrator().reprocess(campaignId)},{'Cache-Control':'no-store'});return true;}
    if(!action && method==='GET'){
      const campaign=await getSocialStudioAutomationOrchestrator().get(campaignId);
      if(!campaign){sendJson(res,404,{error:{code:'STUDIO_CAMPAIGN_NOT_FOUND',message:'Campanha automática não encontrada.'}});return true;}
      sendJson(res,200,{campaign},{'Cache-Control':'no-store'});return true;
    }
  }

  if (pathname === "/api/admin/social-studio/uploads" && method === "POST") {
    const body = await readBody(req);
    const uploaded = await storageService.uploadImage({
      data: body.data || body.base64,
      filename: body.filename,
      contentType: body.contentType,
      folder: "social-studio-source"
    });
    sendJson(res, 201, { ...uploaded, publicUrl: publicAssetUrl(uploaded.url) }, { "Cache-Control": "no-store" });
    return true;
  }

  if (pathname === "/api/admin/social-studio/assets" && method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { loadAsset } = require("./social-studio/engine/assets");
    let buffer = await loadAsset(url.searchParams.get("url") || "", loadSocialStudioImage);
    if (!buffer) {
      sendJson(res, 404, { error: { code: "SOCIAL_ASSET_NOT_FOUND", message: "A imagem solicitada não está disponível." } });
      return true;
    }
    const effectsRequest = url.searchParams.get("render");
    if (effectsRequest) {
      let element;
      try {
        if (effectsRequest.length > 3000) throw new Error("Invalid effects");
        element = JSON.parse(effectsRequest);
        if (!element || typeof element !== "object" || Array.isArray(element)) throw new Error("Invalid effects");
      } catch {
        sendJson(res, 400, { error: { code: "SOCIAL_INVALID_EFFECTS", message: "Os ajustes da imagem são inválidos." } });
        return true;
      }
      buffer = await require("./social-studio/composition-engine/pipeline").createCinematicArtwork(buffer, element);
    }
    const metadata = await sharp(buffer, { failOn: "error" }).metadata();
    const contentType = metadata.format === "jpeg" ? "image/jpeg" : metadata.format === "webp" ? "image/webp" : "image/png";
    res.writeHead(200, {
      ...securityHeaders({
        "Content-Type": contentType,
        "Content-Length": buffer.length,
        "Cache-Control": "private, max-age=300"
      }),
      "Access-Control-Allow-Origin": responseCorsOrigin(req),
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin"
    });
    res.end(buffer);
    return true;
  }

  if (pathname === "/api/admin/social-studio/copy" && method === "POST") {
    const body = await readBody(req);
    const context = socialStudioContext(db);
    const draft = normalizeSocialDraft(body, context);
    const result = require('./social-studio/copy-engine').generateCopy(draft,context,{tone:body.copyTone,density:body.copyDensity,locks:body.copyLocks,seed:Number(body.copySeed)||0});
    sendJson(res,200,result,{'Cache-Control':'no-store'});
    return true;
  }

  if (pathname === "/api/admin/social-studio/resolve" && method === "POST") {
    const body = await readBody(req);
    const context = socialStudioContext(db);
    const normalized = normalizeSocialDraft(body, context);
    if(body.generateCopy===true) {
      const {generateCopy,FIELD_MAP}=require('./social-studio/copy-engine');
      const {bundle}=generateCopy(normalized,context,{tone:body.copyTone,density:body.copyDensity,locks:body.copyLocks});
      for(const [field,key] of Object.entries(FIELD_MAP)) if(body[key]===undefined && !body.copyLocks?.[field]) normalized[key]=bundle[field];
      Object.assign(normalized,normalizeSocialDraft(normalized,context));
    }
    const { entities, ...draft } = normalized;
    sendJson(res, 200, {
      draft,
      caption: captionForDraft(normalized, context),
      notices: socialDraftNotices(normalized, context)
    }, { "Cache-Control": "no-store" });
    return true;
  }

  if (pathname === "/api/admin/social-studio/variations" && method === "POST") {
    const body = await readBody(req);
    const result = await require("./social-studio/composition-engine/variations").generateVariations(body, socialStudioContext(db), { loadImage: loadSocialStudioImage });
    sendJson(res, 200, result, { "Cache-Control": "no-store" });
    return true;
  }

  if (pathname === "/api/admin/social-studio/preview-scene" && method === "POST") {
    const body = await readBody(req);
    const snapshot = require('./social-studio/scene/snapshots').read(String(req.adminUser.id), body.previewToken);
    sendJson(res, 200, {scene:snapshot.scene}, {'Cache-Control':'no-store'});
    return true;
  }

  if (pathname === "/api/admin/social-studio/preview" && method === "POST") {
    const body = await readBody(req);
    const rendered = body.scene
      ? await require('./social-studio/scene/preview-edit').renderPreviewEdit(
        require('./social-studio/scene/snapshots').read(String(req.adminUser.id), body.previewToken), body.scene,
        {loadImage:loadSocialStudioImage, outputType:body.outputType, allowManualLayoutIssues:true})
      : await renderSocialPost(body, socialStudioContext(db), { loadImage: loadSocialStudioImage, allowIncompleteTicket: true });
    res.writeHead(200, {
      ...securityHeaders({
        "Content-Type": rendered.contentType,
        "Content-Length": rendered.buffer.length,
        "X-Social-Scene-Id": require('./social-studio/scene/snapshots').remember(String(req.adminUser.id),rendered),
        "X-Social-Review": encodeURIComponent(JSON.stringify(rendered.notices)),
        "X-Social-Quality": encodeURIComponent(JSON.stringify(rendered.quality ? {technical:rendered.quality.technical,editorial:rendered.quality.editorial} : {})),
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="social-studio-preview${rendered.extension}"`
      }),
      "Access-Control-Allow-Origin": responseCorsOrigin(req),
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin"
    });
    res.end(rendered.buffer);
    return true;
  }

  if (pathname === "/api/admin/social-studio/posts" && method === "POST") {
    const body = await readBody(req);
    const context = socialStudioContext(db);
    require('./social-studio/engine/content-rules').assertContentReady(normalizeSocialDraft(body,context));
    const rendered = body.previewToken
      ? require('./social-studio/scene/preview-edit').withCaption(require('./social-studio/scene/snapshots').read(String(req.adminUser.id),body.previewToken),body.caption)
      : await renderSocialPost(body, context, { loadImage: loadSocialStudioImage });
    require('./social-studio/engine/content-rules').assertContentReady(rendered.draft);
    const uploaded = await storageService.uploadImageBuffer({
      buffer: rendered.buffer,
      filename: `${slugify(rendered.draft.title || rendered.draft.templateId || "post")}${rendered.extension}`,
      contentType: rendered.contentType,
      folder: "social-studio"
    });
    const post = createHistoryRecord(rendered, { savedImageUrl: uploaded.url }, context, req.adminUser || "");
    post.imageUrl = uploaded.url;
    const before = db.settings?.socialStudioPosts || [];
    const history = await persistSocialStudioPosts(db, [post, ...before], req, before);
    logEvent("info", "social_studio.post_created", {
      postId: post.id,
      templateId: post.templateId,
      formatId: post.formatId,
      actorUserId: req.adminUser?.id || ""
    });
    sendJson(res, 201, { post: publicSocialStudioPost(post), history: history.map(publicSocialStudioPost) }, { "Cache-Control": "no-store" });
    return true;
  }

  if (pathname === "/api/admin/social-studio/campaigns" && method === "POST") {
    const body = await readBody(req);
    const context = socialStudioContext(db);
    require('./social-studio/engine/content-rules').assertContentReady(normalizeSocialDraft(body,context));
    const formats = Object.keys(SOCIAL_FORMATS);
    const uploadedUrls = [];
    const campaignId = `campaign-${Date.now()}`;
    const imageCache = new Map();
    const loadCampaignImage = (url) => {
      const key = String(url || "");
      if (!imageCache.has(key)) imageCache.set(key, loadSocialStudioImage(key));
      return imageCache.get(key);
    };
    try {
      const campaign = await generateSocialCampaign({ ...body, formats }, context, { loadImage: loadCampaignImage });
      const renderedItems = campaign.items;
      const posts = [];
      for (const rendered of renderedItems) {
        const uploaded = await storageService.uploadImageBuffer({
          buffer: rendered.buffer,
          filename: `${slugify(rendered.draft.title || rendered.draft.templateId || "campanha")}-${rendered.format.id}${rendered.extension}`,
          contentType: rendered.contentType,
          folder: "social-studio-campaigns"
        });
        uploadedUrls.push(uploaded.url);
        const post = createHistoryRecord(rendered, { savedImageUrl: uploaded.url }, context, req.adminUser || "");
        post.imageUrl = uploaded.url;
        post.campaignId = campaignId;
        posts.push(post);
      }
      const before = db.settings?.socialStudioPosts || [];
      const history = await persistSocialStudioPosts(db, [...posts, ...before], req, before);
      logEvent("info", "social_studio.campaign_created", {
        postIds: posts.map((post) => post.id),
        templateId: body.templateId,
        actorUserId: req.adminUser?.id || ""
      });
      sendJson(res, 201, { posts: posts.map(publicSocialStudioPost), history: history.map(publicSocialStudioPost), metrics: campaign.metrics, rendererVersion: campaign.rendererVersion }, { "Cache-Control": "no-store" });
    } catch (error) {
      await Promise.all(uploadedUrls.map((url) => storageService.deleteByPublicUrl(url).catch(() => false)));
      throw error;
    }
    return true;
  }

  const socialStudioPostMatch = pathname.match(/^\/api\/admin\/social-studio\/posts\/([^/]+)(?:\/(download|scene|scene-draft|scene-versions|scene-export|scene-reset))?$/);
  if (socialStudioPostMatch) {
    const postId = decodeURIComponent(socialStudioPostMatch[1]);
    const action = socialStudioPostMatch[2] || "";
    const posts = db.settings?.socialStudioPosts || [];
    const post = posts.find((item) => String(item.id) === postId);
    if (!post) {
      sendJson(res, 404, { error: { code: "SOCIAL_POST_NOT_FOUND", message: "A arte não foi encontrada no histórico." } });
      return true;
    }
    if (action === "download" && method === "GET") {
      const buffer = await loadSocialStudioImage(post.imageUrl);
      if (!buffer) {
        sendJson(res, 404, { error: { code: "SOCIAL_POST_FILE_NOT_FOUND", message: "O arquivo desta arte não está mais disponível." } });
        return true;
      }
      const contentType = post.outputType === "jpg" ? "image/jpeg" : "image/png";
      res.writeHead(200, {
        ...securityHeaders({
          "Content-Type": contentType,
          "Content-Length": buffer.length,
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename="${socialStudioDownloadName(post)}"`
        }),
        "Access-Control-Allow-Origin": responseCorsOrigin(req),
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin"
      });
      res.end(buffer);
      return true;
    }
    if (action === "scene" && method === "GET") {
      const originalScene = await editableSceneForPost(post, db);
      if (!originalScene) {
        sendJson(res, 409, { error: { code: "SOCIAL_POST_NOT_EDITABLE", message: "Esta arte antiga não possui uma cena editável. Gere uma nova versão no Social Studio." } });
        return true;
      }
      sendJson(res, 200, {
        editable: true,
        post: publicSocialStudioPost(post),
        originalScene,
        editedScene: post.editedScene ? normalizeSocialScene(post.editedScene) : null,
        draftScene: post.draftScene ? normalizeSocialScene(post.draftScene) : null,
        scene: normalizeSocialScene(post.draftScene || post.editedScene || originalScene)
      }, { "Cache-Control": "no-store" });
      return true;
    }
    if (action === "scene-draft" && method === "PUT") {
      const body = await readBody(req);
      const trustedScene=await editableSceneForPost(post,db);
      const scene = normalizeSocialScene(require('./social-studio/scene/preview-edit').editableSnapshot({scene:trustedScene},body.scene || body));
      const now = new Date().toISOString();
      const updated = {
        ...post,
        draftScene: scene,
        draftSavedAt: now,
        draftSavedBy: String(req.adminUser?.id || ""),
        updatedAt: now
      };
      const history = posts.map((item) => String(item.id) === postId ? updated : item);
      await persistSocialStudioPosts(db, history, req, posts);
      sendJson(res, 200, { saved: true, savedAt: now }, { "Cache-Control": "no-store" });
      return true;
    }
    if (action === "scene-versions" && method === "POST") {
      const body = await readBody(req);
      const outputType = body.outputType === "jpg" ? "jpg" : "png";
      const trustedScene=await editableSceneForPost(post,db);
      const rendered = await renderSocialScene(require('./social-studio/scene/preview-edit').editableSnapshot({scene:trustedScene},body.scene || body), { loadImage: loadSocialStudioImage, outputType, allowManualLayoutIssues: true });
      const uploaded = await storageService.uploadImageBuffer({
        buffer: rendered.buffer,
        filename: `${slugify(post.title || post.templateName || "post")}-editado${rendered.extension}`,
        contentType: rendered.contentType,
        folder: "social-studio-edits"
      });
      const now = new Date().toISOString();
      const versionId = `edit-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      const version = {
        id: versionId,
        kind: "manual",
        imageUrl: uploaded.url,
        outputType,
        scene: rendered.scene,
        createdAt: now,
        createdBy: String(req.adminUser?.id || "")
      };
      const versions = [...(Array.isArray(post.sceneVersions) ? post.sceneVersions : []), version].slice(-12);
      const updated = {
        ...post,
        originalImageUrl: post.originalImageUrl || post.imageUrl,
        originalScene: post.originalScene || await editableSceneForPost(post, db),
        imageUrl: uploaded.url,
        outputType,
        editedScene: rendered.scene,
        draftScene: null,
        activeVersion: versionId,
        sceneVersions: versions,
        updatedAt: now
      };
      const history = posts.map((item) => String(item.id) === postId ? updated : item);
      await persistSocialStudioPosts(db, history, req, posts);
      logEvent("info", "social_studio.scene_version_created", { postId, versionId, actorUserId: req.adminUser?.id || "" });
      sendJson(res, 201, { post: publicSocialStudioPost(updated), scene: rendered.scene, version: { ...version, scene: undefined } }, { "Cache-Control": "no-store" });
      return true;
    }
    if (action === "scene-export" && method === "POST") {
      const body = await readBody(req);
      const outputType = body.outputType === "jpg" ? "jpg" : "png";
      const trustedScene=await editableSceneForPost(post,db);
      const rendered = await renderSocialScene(require('./social-studio/scene/preview-edit').editableSnapshot({scene:trustedScene},body.scene || body), { loadImage: loadSocialStudioImage, outputType, allowManualLayoutIssues: true });
      res.writeHead(200, {
        ...securityHeaders({
          "Content-Type": rendered.contentType,
          "Content-Length": rendered.buffer.length,
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename="${slugify(post.title || "post")}-editado${rendered.extension}"`
        }),
        "Access-Control-Allow-Origin": responseCorsOrigin(req),
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin"
      });
      res.end(rendered.buffer);
      return true;
    }
    if (action === "scene-reset" && method === "POST") {
      const originalScene = await editableSceneForPost(post, db);
      if (!originalScene) {
        sendJson(res, 409, { error: { code: "SOCIAL_POST_NOT_EDITABLE", message: "A versão automática original não está disponível." } });
        return true;
      }
      const updated = {
        ...post,
        originalScene: post.originalScene || originalScene,
        imageUrl: post.originalImageUrl || post.imageUrl,
        editedScene: null,
        draftScene: null,
        activeVersion: "automatic",
        updatedAt: new Date().toISOString()
      };
      const history = posts.map((item) => String(item.id) === postId ? updated : item);
      await persistSocialStudioPosts(db, history, req, posts);
      sendJson(res, 200, { post: publicSocialStudioPost(updated), scene: originalScene }, { "Cache-Control": "no-store" });
      return true;
    }
    if (!action && method === "DELETE") {
      const history = posts.filter((item) => String(item.id) !== postId);
      const urls = new Set([
        post.imageUrl,
        post.originalImageUrl,
        ...(Array.isArray(post.sceneVersions) ? post.sceneVersions.map((version) => version.imageUrl) : [])
      ].filter(Boolean));
      await Promise.all([...urls].map((url) => storageService.deleteByPublicUrl(url).catch(() => false)));
      await persistSocialStudioPosts(db, history, req, posts);
      logEvent("info", "social_studio.post_deleted", { postId, actorUserId: req.adminUser?.id || "" });
      await getSocialAnimationJobs().removePost(postId);
      sendJson(res, 200, { deleted: true, id: postId, history: history.map(publicSocialStudioPost) }, { "Cache-Control": "no-store" });
      return true;
    }
  }
    return false;
  };
}

module.exports = { createAdminSocialStudioRoutes };
