function createBackendMaintenanceTasks({
  withCriticalMutation, readDb, writeDb, applyScheduledPremieres,
  applyAutomatedMovieTags, archiveFinishedSessions, pruneExpiredTicketPdfArtifacts,
  expireStaleReservations, syncScheduledCampaignCoupons, archiveExpiredCoupons,
  expirePendingPaymentSubscriptions, finalizeEndingSubscriptions,
  cleanupExpiredCheckoutOrders, logEvent, ticketDocumentRetentionDays,
  movieImageService, deleteUnreferencedAssets, postgresEnabled,
  emailCampaignRepository, path, fs, emailAttachmentRoot,
  settingsRepository, pruneSystemLogsFromPostgres, businessLogEvents
}) {
  let movieImageMaintenanceRunning = false;
  let emailAttachmentMaintenanceRunning = false;
  const TICKET_ARCHIVED_DOCUMENT_RETENTION_DAYS = ticketDocumentRetentionDays;
  const EMAIL_ATTACHMENT_ROOT = emailAttachmentRoot;
  const BUSINESS_LOG_EVENTS = businessLogEvents;
  async function runSubscriptionMaintenance() {
    const expiredCheckoutOrders = [];
    try {
      await withCriticalMutation(async () => {
        const db = await readDb();
        const scheduledChanged = applyScheduledPremieres(db);
        const movieTagsChanged = applyAutomatedMovieTags(db);
        const sessionMaintenance = archiveFinishedSessions(db, new Date(), expiredCheckoutOrders);
        const ticketPdfMaintenance = await pruneExpiredTicketPdfArtifacts(db, new Date());
        const reservationsChanged = expireStaleReservations(db, expiredCheckoutOrders);
        const scheduledCoupons = syncScheduledCampaignCoupons(db, new Date());
        const couponMaintenance = archiveExpiredCoupons(db, new Date());
        const result = await expirePendingPaymentSubscriptions(db);
        const lifecycle = finalizeEndingSubscriptions(db);
        if (scheduledChanged || movieTagsChanged || sessionMaintenance.changed || ticketPdfMaintenance.changed || reservationsChanged || scheduledCoupons.changed || couponMaintenance.changed || result.changed || lifecycle.changed) {
          await writeDb(db);
          sessionMaintenance.archived.forEach((session) => logEvent("info", "session.finished_archived", session));
          ticketPdfMaintenance.purgedTicketIds.forEach((ticketId) => logEvent("info", "ticket.pdf_artifacts_pruned", {
            ticketId,
            retentionDays: TICKET_ARCHIVED_DOCUMENT_RETENTION_DAYS
          }));
          couponMaintenance.archived.forEach((coupon) => logEvent("info", "coupon.expired_archived", coupon));
          scheduledCoupons.coupons.forEach((coupon) => logEvent("info", coupon.active ? "coupon.scheduled_activated" : "coupon.scheduled_deactivated", coupon));
          logEvent("info", "subscription.pending_payment_maintenance", {
            expired: result.expired,
            failed: result.failed,
            finalized: lifecycle.finalized,
            catalogUpdated: scheduledChanged || movieTagsChanged,
            sessionsArchived: sessionMaintenance.archived.length,
            ticketPdfArtifactsPurged: ticketPdfMaintenance.purgedTicketIds.length,
            reservationsExpired: reservationsChanged,
            couponsArchived: couponMaintenance.archived.length
          });
        }
      });
      await cleanupExpiredCheckoutOrders(expiredCheckoutOrders);
    } catch (error) {
      logEvent("warn", "subscription.pending_payment_maintenance_failed", {
        code: error?.code || "SUBSCRIPTION_MAINTENANCE_FAILED",
        message: error?.message || "Falha ao executar manutencao do Clube."
      });
    }
  }

  async function runMovieImageMaintenance() {
    if (String(process.env.MOVIE_IMAGE_MAINTENANCE_ENABLED || "true").toLowerCase() === "false") return;
    if (movieImageMaintenanceRunning) return;
    movieImageMaintenanceRunning = true;
    try {
      const snapshot = await readDb();
      const candidates = (snapshot.movies || []).filter((movie) => {
        const workflowStatus = movie.workflowStatus || (movie.status === "hidden" ? "archived" : "published");
        return workflowStatus === "published" && movieImageService.needsLocalization(movie);
      });
      for (const candidate of candidates) {
        let localized;
        try {
          localized = await movieImageService.localizeMovie(candidate);
          if (!localized.changed) continue;
          const appliedAssets = [];
          await withCriticalMutation(async () => {
            const db = await readDb();
            const current = (db.movies || []).find((movie) => movie.id === candidate.id);
            if (!current) return;
            for (const asset of localized.assets) {
              if (current[asset.field] !== asset.previousUrl) continue;
              current[asset.field] = asset.localUrl;
              current.metadata = { ...(current.metadata || {}) };
              current.metadata[asset.field === "posterUrl" ? "tmdbPosterSourceUrl" : "tmdbBackdropSourceUrl"] = asset.sourceUrl;
              appliedAssets.push(asset);
            }
            if (!appliedAssets.length) return;
            current.metadata.imagesLocalizedAt = new Date().toISOString();
            current.updatedAt = new Date().toISOString();
            await writeDb(db);
          });
          const appliedUrls = new Set(appliedAssets.map((asset) => asset.localUrl));
          await movieImageService.cleanupAssets(localized.assets.filter((asset) => !appliedUrls.has(asset.localUrl)));
          if (appliedAssets.length) {
            const currentDb = await readDb();
            await deleteUnreferencedAssets(currentDb, appliedAssets.map((asset) => asset.previousUrl));
            logEvent("info", "movie.images_localized", { movieId: candidate.id, assets: appliedAssets.map((asset) => asset.field) });
          }
        } catch (error) {
          if (localized?.assets?.length) await movieImageService.cleanupAssets(localized.assets);
          logEvent("warn", "movie.images_localization_failed", {
            movieId: candidate.id,
            code: error.code || "TMDB_IMAGE_DOWNLOAD_FAILED",
            message: error.message
          });
        }
      }
      const currentDb = await readDb();
      for (const movie of currentDb.movies || []) {
        const removed = await movieImageService.pruneLocalizedAssets(movie);
        if (removed) logEvent("info", "movie.images_obsolete_pruned", { movieId: movie.id, removed });
      }
    } finally {
      movieImageMaintenanceRunning = false;
    }
  }

  async function runEmailAttachmentMaintenance() {
    if (emailAttachmentMaintenanceRunning) return;
    emailAttachmentMaintenanceRunning = true;
    try {
      const db = await readDb();
      const referenced = new Set(postgresEnabled()
        ? await emailCampaignRepository.listReferencedAttachmentIds()
        : (db.emailCampaigns || []).flatMap((campaign) => (campaign.attachments || []).map((item) => item.id)));
      const retentionDays = Math.max(7, Math.min(365, Number(process.env.EMAIL_ATTACHMENT_RETENTION_DAYS || 30)));
      const cutoff = Date.now() - retentionDays * 86400000;
      const kept = [];
      for (const attachment of db.settings?.emailAttachments || []) {
        if (referenced.has(attachment.id)) { kept.push(attachment); continue; }
        const safePath = path.resolve(String(attachment.path || ""));
        const relative = path.relative(EMAIL_ATTACHMENT_ROOT, safePath);
        if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) { kept.push(attachment); continue; }
        const stat = await fs.stat(safePath).catch(() => null);
        const createdAt = new Date(attachment.createdAt || stat?.mtime || 0).getTime();
        if (!Number.isFinite(createdAt) || createdAt > cutoff) { kept.push(attachment); continue; }
        await fs.unlink(safePath).catch(() => null);
        logEvent("info", "email_campaign.attachment_pruned", { attachmentId: attachment.id, retentionDays });
      }
      if (kept.length !== (db.settings?.emailAttachments || []).length) {
        db.settings.emailAttachments = kept;
        if (postgresEnabled()) await settingsRepository.updateSection("emailAttachments", kept);
        else await writeDb(db);
      }
    } finally {
      emailAttachmentMaintenanceRunning = false;
    }
  }

  async function runSystemLogMaintenance() {
    if (!postgresEnabled()) return;
    try {
      const technicalRetentionDays = Math.min(3650, Math.max(1, Number(process.env.TECHNICAL_LOG_RETENTION_DAYS || 3)));
      const retentionDays = Math.min(3650, Math.max(1, Number(process.env.SYSTEM_LOG_RETENTION_DAYS || 90)));
      const result = await pruneSystemLogsFromPostgres({
        retentionDays,
        technicalRetentionDays,
        businessEvents: [...BUSINESS_LOG_EVENTS]
      });
      if (result.total > 0) {
        logEvent("info", "logs.retention_applied", {
          technicalRetentionDays,
          retentionDays,
          deletedTechnical: result.deletedTechnical,
          deletedGeneral: result.deletedGeneral,
          totalDeleted: result.total
        });
      }
    } catch (error) {
      logEvent("warn", "logs.retention_failed", { message: error.message });
    }
  }

  return { runSubscriptionMaintenance, runMovieImageMaintenance,
    runEmailAttachmentMaintenance, runSystemLogMaintenance };
}

module.exports = { createBackendMaintenanceTasks };
