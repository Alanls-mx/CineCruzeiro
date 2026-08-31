const assert = require("assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createStorageService } = require("../backend/services/storageService");
const { createMovieImageService, isTmdbImageUrl, needsLocalization } = require("../backend/services/movieImageService");

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function filesBelow(root) {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat();
}

async function run() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "cine-movie-images-"));
  const storageService = createStorageService({ publicDir: rootDir, rootDir });
  const requested = [];
  const service = createMovieImageService({
    storageService,
    fetchImpl: async (url) => {
      requested.push(url);
      return new Response(PNG, { status: 200, headers: { "content-type": "image/png", "content-length": String(PNG.length) } });
    }
  });

  try {
    assert.equal(isTmdbImageUrl("https://image.tmdb.org/t/p/w780/poster.jpg"), true);
    assert.equal(isTmdbImageUrl("http://image.tmdb.org/t/p/w780/poster.jpg"), false);
    assert.equal(isTmdbImageUrl("https://image.tmdb.org.evil.test/t/p/w780/poster.jpg"), false);
    assert.equal(isTmdbImageUrl("https://image.tmdb.org/not-images/poster.jpg"), false);

    const posterSource = "https://image.tmdb.org/t/p/w780/poster.jpg";
    const backdropSource = "https://image.tmdb.org/t/p/w1280/backdrop.jpg";
    const localized = await service.localizeMovie({
      id: "filme-teste",
      posterUrl: posterSource,
      backdropUrl: backdropSource,
      metadata: { tmdbId: 123 }
    });

    assert.equal(localized.changed, true);
    assert.equal(localized.assets.length, 2);
    assert.equal(requested.length, 2);
    assert.match(localized.movie.posterUrl, /^\/uploads\/movies-filme-teste\/poster-filme-teste-/);
    assert.match(localized.movie.backdropUrl, /^\/uploads\/movies-filme-teste\/backdrop-filme-teste-/);
    assert.match(localized.movie.posterUrl, /\.jpg$/);
    assert.match(localized.movie.backdropUrl, /\.jpg$/);
    assert.equal(localized.movie.metadata.tmdbPosterSourceUrl, posterSource);
    assert.equal(localized.movie.metadata.tmdbBackdropSourceUrl, backdropSource);
    assert.ok(localized.movie.metadata.imagesLocalizedAt);
    assert.equal((await filesBelow(rootDir)).length, 2);

    await service.cleanupAssets(localized.assets);
    assert.equal((await filesBelow(rootDir)).length, 0);

    const legacyMovie = {
      id: "filme-legado",
      posterUrl: "/uploads/movies-filme-legado/poster-filme-legado.webp",
      backdropUrl: "/uploads/movies-filme-legado/backdrop-filme-legado.webp",
      metadata: { tmdbPosterSourceUrl: posterSource, tmdbBackdropSourceUrl: backdropSource }
    };
    assert.equal(needsLocalization(legacyMovie), true);
    const upgraded = await service.localizeMovie(legacyMovie);
    assert.equal(upgraded.assets.every((asset) => asset.previousUrl.endsWith(".webp")), true);
    assert.equal(upgraded.assets.every((asset) => asset.localUrl.endsWith(".jpg")), true);
    assert.equal(needsLocalization(upgraded.movie), false);
    await service.cleanupAssets(upgraded.assets);

    const partialFailure = createMovieImageService({
      storageService,
      fetchImpl: async (url) => {
        if (String(url).includes("backdrop")) return new Response("falha", { status: 503 });
        return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
      }
    });
    await assert.rejects(
      partialFailure.localizeMovie({ id: "falha-parcial", posterUrl: posterSource, backdropUrl: backdropSource }),
      (error) => error.code === "TMDB_IMAGE_DOWNLOAD_FAILED" && error.statusCode === 502
    );
    assert.equal((await filesBelow(rootDir)).length, 0);

    console.log("Movie image localization tests passed.");
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
