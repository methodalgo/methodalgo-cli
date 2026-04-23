/**
 * FRED API Client — Pure Node.js wrapper for Federal Reserve Economic Data API.
 * Uses native fetch (Node 18+). No external dependencies.
 * 
 * Covers ALL free FRED API v1 endpoints:
 * - Categories, Releases, Series, Sources, Tags, Maps (GeoFRED)
 */

import config from "./config-manager.js";

const FRED_BASE = "https://api.stlouisfed.org/fred";
const GEOFRED_BASE = "https://api.stlouisfed.org/geofred";

/**
 * Get FRED API key from config or env
 */
export function getFredApiKey() {
    return process.env.FRED_API_KEY || config.get("fredApiKey") || "";
}

/**
 * Core request function for FRED API
 */
async function fredRequest(basePath, endpoint, params = {}) {
    const apiKey = getFredApiKey();
    if (!apiKey) {
        throw new Error(
            "FRED API Key not configured.\n" +
            "Set it with: methodalgo config set fred-api-key <your-key>\n" +
            "Get a free key at: https://fred.stlouisfed.org/docs/api/api_key.html"
        );
    }

    const url = new URL(`${basePath}/${endpoint}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("file_type", "json");
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") {
            url.searchParams.set(k, String(v));
        }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const res = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`FRED API error ${res.status}: ${text || res.statusText}`);
        }
        return await res.json();
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === "AbortError") throw new Error("FRED API request timed out (15s)");
        throw err;
    }
}

// ─── Categories ─────────────────────────────────────────────────

export async function getCategory(params) {
    return fredRequest(FRED_BASE, "category", params);
}

export async function getCategoryChildren(params) {
    return fredRequest(FRED_BASE, "category/children", params);
}

export async function getCategoryRelated(params) {
    return fredRequest(FRED_BASE, "category/related", params);
}

export async function getCategorySeries(params) {
    return fredRequest(FRED_BASE, "category/series", params);
}

export async function getCategoryTags(params) {
    return fredRequest(FRED_BASE, "category/tags", params);
}

export async function getCategoryRelatedTags(params) {
    return fredRequest(FRED_BASE, "category/related_tags", params);
}

// ─── Releases ───────────────────────────────────────────────────

export async function getReleases(params) {
    return fredRequest(FRED_BASE, "releases", params);
}

export async function getReleasesDates(params) {
    return fredRequest(FRED_BASE, "releases/dates", params);
}

export async function getRelease(params) {
    return fredRequest(FRED_BASE, "release", params);
}

export async function getReleaseDates(params) {
    return fredRequest(FRED_BASE, "release/dates", params);
}

export async function getReleaseSeries(params) {
    return fredRequest(FRED_BASE, "release/series", params);
}

export async function getReleaseSources(params) {
    return fredRequest(FRED_BASE, "release/sources", params);
}

export async function getReleaseTags(params) {
    return fredRequest(FRED_BASE, "release/tags", params);
}

export async function getReleaseRelatedTags(params) {
    return fredRequest(FRED_BASE, "release/related_tags", params);
}

export async function getReleaseTables(params) {
    return fredRequest(FRED_BASE, "release/tables", params);
}

// ─── Series ─────────────────────────────────────────────────────

export async function getSeries(params) {
    return fredRequest(FRED_BASE, "series", params);
}

export async function getSeriesCategories(params) {
    return fredRequest(FRED_BASE, "series/categories", params);
}

export async function getSeriesObservations(params) {
    return fredRequest(FRED_BASE, "series/observations", params);
}

export async function getSeriesRelease(params) {
    return fredRequest(FRED_BASE, "series/release", params);
}

export async function getSeriesSearch(params) {
    return fredRequest(FRED_BASE, "series/search", params);
}

export async function getSeriesSearchTags(params) {
    return fredRequest(FRED_BASE, "series/search/tags", params);
}

export async function getSeriesSearchRelatedTags(params) {
    return fredRequest(FRED_BASE, "series/search/related_tags", params);
}

export async function getSeriesTags(params) {
    return fredRequest(FRED_BASE, "series/tags", params);
}

export async function getSeriesUpdates(params) {
    return fredRequest(FRED_BASE, "series/updates", params);
}

export async function getSeriesVintageDates(params) {
    return fredRequest(FRED_BASE, "series/vintagedates", params);
}

// ─── Sources ────────────────────────────────────────────────────

export async function getSources(params) {
    return fredRequest(FRED_BASE, "sources", params);
}

export async function getSource(params) {
    return fredRequest(FRED_BASE, "source", params);
}

export async function getSourceReleases(params) {
    return fredRequest(FRED_BASE, "source/releases", params);
}

// ─── Tags ───────────────────────────────────────────────────────

export async function getTags(params) {
    return fredRequest(FRED_BASE, "tags", params);
}

export async function getRelatedTags(params) {
    return fredRequest(FRED_BASE, "related_tags", params);
}

export async function getTagsSeries(params) {
    return fredRequest(FRED_BASE, "tags/series", params);
}

// ─── GeoFRED (Maps) ────────────────────────────────────────────

export async function getGeoShapes(params) {
    return fredRequest(GEOFRED_BASE, "shapes/file", params);
}

export async function getGeoSeriesGroup(params) {
    return fredRequest(GEOFRED_BASE, "series/group", params);
}

export async function getGeoSeriesData(params) {
    return fredRequest(GEOFRED_BASE, "series/data", params);
}

export async function getGeoRegionalData(params) {
    return fredRequest(GEOFRED_BASE, "regional/data", params);
}
