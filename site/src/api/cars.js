// Miami-Dade car directory: D1 queries for the public pages and the admin endpoints.
import { json, text, readJson, rid, slugify, noTable, MIGRATE } from "./util.js";
import { deleteImages, PHOTO_ID } from "./media.js";
import { MAKES, BODIES, AREAS, TRANSMISSIONS, FUELS, TITLES, SELLERS, CAR_SORTS } from "../data/cars.js";
import { miamiToday } from "../render/cars.mjs";

export const CAR_ID = /^[a-z0-9][a-z0-9-]{2,80}$/;
export const PAGE_SIZE = 24;
const LISTED = "status IN ('available','pending')";
const ORDER = { new: "spotted DESC, created_at DESC", price: "price IS NULL, price ASC, spotted DESC", "price-desc": "price IS NULL, price DESC, spotted DESC", miles: "mileage IS NULL, mileage ASC, spotted DESC", year: "year IS NULL, year DESC, spotted DESC" };
const STATUSES = ["draft", "available", "pending", "sold"];
const FIELDS = ["status", "year", "make", "model", "trim", "price", "mileage", "body", "transmission", "fuel", "color", "vin", "title_status", "seller", "area", "phone", "description", "photos", "spotted"];

const parsePhotos = (s) => { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a.filter(x => PHOTO_ID.test(x)) : []; } catch { return []; } };
const row = (r) => r && { ...r, photos: parsePhotos(r.photos) };

// ---------- public
export function carFilters(params) {
  const g = (k, max = 60) => String(params.get(k) || "").trim().slice(0, max);
  const max = parseInt(g("max"), 10), page = parseInt(g("page"), 10);
  return { q: g("q", 80), make: g("make"), body: g("body"), area: g("area"), max: max > 0 ? String(max) : "", sort: CAR_SORTS.some(([v]) => v === g("sort")) ? g("sort") : "new", page: page > 1 ? Math.min(page, 500) : 1 };
}

export async function listCars(env, f) {
  const where = [LISTED], args = [];
  for (const w of f.q.split(/\s+/).filter(Boolean).slice(0, 6)) {
    where.push("(IFNULL(year,'') || ' ' || IFNULL(make,'') || ' ' || IFNULL(model,'') || ' ' || IFNULL(trim,'') || ' ' || IFNULL(color,'') || ' ' || IFNULL(body,'') || ' ' || IFNULL(area,'') || ' ' || IFNULL(description,'')) LIKE ?");
    args.push(`%${w}%`);
  }
  if (f.make) { where.push("make = ? COLLATE NOCASE"); args.push(f.make); }
  if (f.body) { where.push("body = ? COLLATE NOCASE"); args.push(f.body); }
  if (f.area) { where.push("area = ? COLLATE NOCASE"); args.push(f.area); }
  if (f.max) { where.push("price <= ?"); args.push(+f.max); }
  const w = where.join(" AND ");
  const [rows, count] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM cars WHERE ${w} ORDER BY ${ORDER[f.sort] || ORDER.new} LIMIT ? OFFSET ?`).bind(...args, PAGE_SIZE, (f.page - 1) * PAGE_SIZE),
    env.DB.prepare(`SELECT COUNT(*) n FROM cars WHERE ${w}`).bind(...args),
  ]);
  return { cars: rows.results.map(row), total: count.results[0].n };
}

/** Values to offer in the filter dropdowns: [[value, count]] for listed cars only. */
export async function carFacets(env) {
  const { results } = await env.DB.prepare(`SELECT make, body, area FROM cars WHERE ${LISTED}`).all();
  const tally = (k) => Object.entries(results.reduce((m, r) => { const v = String(r[k] || "").trim(); if (v) m[v] = (m[v] || 0) + 1; return m; }, {})).sort((a, b) => a[0].localeCompare(b[0]));
  return { makes: tally("make"), bodies: tally("body"), areas: tally("area"), total: results.length };
}

export const getCar = async (env, id) => row(await env.DB.prepare("SELECT * FROM cars WHERE id = ?").bind(id).first());

/** Other listed cars, same area first. */
export async function moreCars(env, car, n = 4) {
  const { results } = await env.DB.prepare(`SELECT * FROM cars WHERE ${LISTED} AND id != ? ORDER BY (area = ?) DESC, spotted DESC, created_at DESC LIMIT ?`).bind(car.id, car.area || "", n).all();
  return results.map(row);
}

export async function listedCarIds(env) {
  return (await env.DB.prepare(`SELECT id, updated_at FROM cars WHERE ${LISTED}`).all()).results;
}

// ---------- admin
const str = (v, max = 80) => String(v ?? "").trim().slice(0, max);
/** "$12,500" -> 12500, "84k" -> 84000, "" -> null */
export function num(v, lo, hi) {
  const m = /^(\d+(?:\.\d+)?)(k)?$/i.exec(String(v ?? "").replace(/[$,\s]|mi(les)?$/gi, ""));
  if (!m) return null;
  const n = Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1));
  return n >= lo && n <= hi ? n : null;
}
/** Canonical spelling from a list ("bmw" -> "BMW"); otherwise fix ALL-CAPS/lowercase to Title Case and keep anything else as typed. */
export function canon(v, list) {
  const s = str(v, 60); if (!s) return "";
  const hit = list.find(x => x.toLowerCase() === s.toLowerCase());
  if (hit) return hit;
  return s === s.toUpperCase() || s === s.toLowerCase() ? s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, c => c.toUpperCase()) : s;
}
const pick = (v, list) => list.find(x => x.toLowerCase() === str(v).toLowerCase()) || "";

export function cleanCar(b) {
  const photos = (Array.isArray(b.photos) ? b.photos : []).filter(p => PHOTO_ID.test(p)).slice(0, 40);
  const spotted = /^\d{4}-\d{2}-\d{2}$/.test(b.spotted || "") ? b.spotted : miamiToday();
  const vin = str(b.vin, 17).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return {
    status: STATUSES.includes(b.status) ? b.status : "draft",
    year: num(b.year, 1900, new Date().getFullYear() + 2), make: canon(b.make, MAKES), model: str(b.model, 60), trim: str(b.trim, 60),
    price: num(b.price, 0, 50_000_000), mileage: num(b.mileage, 0, 2_000_000),
    body: pick(b.body, BODIES), transmission: pick(b.transmission, TRANSMISSIONS), fuel: pick(b.fuel, FUELS), color: canon(b.color, []),
    vin, title_status: pick(b.title_status, TITLES), seller: pick(b.seller, SELLERS), area: canon(b.area, AREAS),
    phone: str(b.phone, 40), description: str(b.description, 6000), photos: JSON.stringify(photos), spotted,
  };
}

export async function carsAdmin(request, env) {
  try {
    if (request.method === "GET") return json({ cars: (await env.DB.prepare("SELECT * FROM cars ORDER BY updated_at DESC").all()).results.map(row), media: !!env.MEDIA });
    const b = await readJson(request); if (!b) return text("bad json", 400);
    if (request.method === "DELETE") {
      const c = await getCar(env, String(b.id || "")); if (!c) return text("not found", 404);
      await env.DB.prepare("DELETE FROM cars WHERE id = ?").bind(c.id).run();
      await deleteImages(env, "cars", c.photos);
      return json({ ok: true });
    }
    if (request.method !== "POST") return text("method not allowed", 405);
    const car = cleanCar(b), now = Date.now(), vals = FIELDS.map(f => car[f]);
    if (b.id) {
      const old = await getCar(env, String(b.id)); if (!old) return text("not found", 404);
      await env.DB.prepare(`UPDATE cars SET ${FIELDS.map(f => `${f} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, now, old.id).run();
      const keep = new Set(JSON.parse(car.photos));
      await deleteImages(env, "cars", old.photos.filter(p => !keep.has(p)));
      return json({ ok: true, car: await getCar(env, old.id) });
    }
    const id = `${slugify([car.year, car.make, car.model, car.trim].filter(Boolean).join(" ")) || "car"}-${rid(4)}`;
    await env.DB.prepare(`INSERT INTO cars (id, ${FIELDS.join(", ")}, created_at, updated_at) VALUES (?, ${FIELDS.map(() => "?").join(", ")}, ?, ?)`).bind(id, ...vals, now, now).run();
    return json({ ok: true, car: await getCar(env, id) });
  } catch (e) {
    if (noTable(e)) return json({ error: MIGRATE }, 503);
    throw e;
  }
}

// ---------- VIN decode (NHTSA vPIC, free, no key), proxied so the admin works from any browser
const BODY_MAP = [[/pickup/i, "Truck"], [/sport utility|\bsuv\b|crossover|\bcuv\b/i, "SUV"], [/minivan/i, "Minivan"], [/\bvan\b/i, "Van"], [/convertible|cabriolet|roadster/i, "Convertible"], [/coupe/i, "Coupe"], [/hatchback|liftback/i, "Hatchback"], [/wagon/i, "Wagon"], [/sedan|saloon/i, "Sedan"], [/motorcycle/i, "Motorcycle"]];
export function decodeVin(x = {}) {
  const ev = String(x.ElectrificationLevel || "");
  const fuel = /BEV/.test(ev) || /^electric/i.test(x.FuelTypePrimary || "") ? "Electric" : /HEV/.test(ev) || /electric/i.test(x.FuelTypeSecondary || "") ? "Hybrid" : /diesel/i.test(x.FuelTypePrimary || "") ? "Diesel" : /gasoline|flexible/i.test(x.FuelTypePrimary || "") ? "Gas" : "";
  const out = {
    year: x.ModelYear || "", make: x.Make ? canon(x.Make, MAKES) : "", model: x.Model || "", trim: x.Trim || x.Series || "",
    body: BODY_MAP.find(([re]) => re.test(x.BodyClass || ""))?.[1] || "", fuel,
    transmission: /manual/i.test(x.TransmissionStyle || "") ? "Manual" : /auto|cvt|dual/i.test(x.TransmissionStyle || "") ? "Automatic" : "",
  };
  return out.make || out.model ? out : { ...out, error: x.ErrorText || "NHTSA couldn't decode that VIN." };
}

export async function vin(request) {
  const v = (new URL(request.url).searchParams.get("vin") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (v.length !== 17 || /[IOQ]/.test(v)) return text("A VIN is 17 letters and numbers (never I, O or Q).", 422);
  const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${v}?format=json`, { cf: { cacheTtl: 86400, cacheEverything: true } }).catch(() => null);
  if (!r?.ok) return text("NHTSA's VIN service didn't answer. Try again, or fill the fields by hand.", 502);
  return json(decodeVin((await r.json().catch(() => ({})))?.Results?.[0]));
}
