// Legacy snapshot defaults are applied at read time in both JSON and PostgreSQL modes.
// Installation-specific copy is supplied by the server, not fixed in this module.
function normalizeSnapshotSettings(db, { cinemaName, announcementText, normalizeTicketDistributorRules, storedEditorialImageUrl }) {
  db.settings = {
    cinemaName,
    defaultTicketPrice: 10,
    currency: "BRL",
    salesChannel: "Site + Pix",
    heroTrailerBackgroundEnabled: false,
    announcementEnabled: true,
    announcementText,
    clubTransparentImages: false,
    clubHeroImageUrl: "",
    clubBannerImageUrl: "",
    eventTransparentImages: false,
    eventHeroImageUrl: "",
    eventGamesImageUrl: "",
    eventPartiesImageUrl: "",
    eventCorporateImageUrl: "",
    eventGalleryImageUrl: "",
    eventStartingPrice: 450,
    adminTwoFactorRequired: true,
    ticketDistributorRules: {
      distributorPercent: 50,
      courtesyPercent: 50,
      clubTicketFee: 10
    },
    ...db.settings
  };
  if (/whatsapp/i.test(String(db.settings.salesChannel || ""))) db.settings.salesChannel = "Site + Pix";
  db.settings.ticketDistributorRules = normalizeTicketDistributorRules(db.settings.ticketDistributorRules);
  [
    "clubHeroImageUrl",
    "clubBannerImageUrl",
    "eventHeroImageUrl",
    "eventGamesImageUrl",
    "eventPartiesImageUrl",
    "eventCorporateImageUrl",
    "eventGalleryImageUrl"
  ].forEach((key) => {
    db.settings[key] = storedEditorialImageUrl(db.settings[key]);
  });
}

module.exports = { normalizeSnapshotSettings };
