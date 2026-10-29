export const UTENSILIOS: Record<string, string> = {
  olla_presion: 'Olla de presión', ollas_novel: 'Ollas', sarten: 'Sartenes', sarten_gourmet: 'Sartén Gourmet',
  deluxe_easy_release: 'Deluxe Easy Release', paellera: 'Paellera', plancha_parrilla: 'Planchas y parrilla', pavera: 'Pavera',
  casserole: 'Casserole', olla_grande: 'Ollas grandes', maxtractor: 'Maxtractor (jugos)', smart_temp: 'Smart Temp',
  chocolatera: 'Chocolatera', expertea: 'ExperTea', espresso: 'Espresso', barista: 'Barista', cuchillos: 'Cuchillos',
  tazones: 'Tazones', otro_royal: 'Otros Royal',
};
export const CATEGORIAS: Record<string, string> = {
  desayuno: 'Desayuno', entradas_snacks: 'Entradas y snacks', carnes: 'Carnes', pollo: 'Pollo', pescados_mariscos: 'Pescados y mariscos',
  pastas_arroces: 'Pastas y arroces', sopas_guisos: 'Sopas y guisos', vegetariano: 'Vegetariano', ensaladas: 'Ensaladas',
  postres: 'Postres', panes_masas: 'Panes y masas', bebidas: 'Bebidas', salsas_aderezos: 'Salsas y aderezos',
};
export const esTitulo = (l: string) => { const t = l.trim(); return t.length < 70 && !/^\d/.test(t) && (t.endsWith(':') || /^(decoraci[oó]n|para (el|la|los|las|decorar|servir|montar))\b/i.test(t) && !/\d/.test(t)); };

/** Utensilio de recetas que corresponde a un producto del catálogo (por nombre). */
export function utensilioDeProducto(nombre: string): string | null {
  const n = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const reglas: [RegExp, string][] = [
    [/presion/, 'olla_presion'], [/paellera/, 'paellera'], [/pavera/, 'pavera'], [/casserole|cacerola/, 'casserole'],
    [/gourmet/, 'sarten_gourmet'], [/deluxe|easy release/, 'deluxe_easy_release'], [/sarten/, 'sarten'],
    [/plancha|parrilla/, 'plancha_parrilla'], [/(12|20|30) cuartos/, 'olla_grande'], [/maxtractor/, 'maxtractor'],
    [/smart temp/, 'smart_temp'], [/chocolatera/, 'chocolatera'], [/expertea/, 'expertea'], [/espresso/, 'espresso'],
    [/barista/, 'barista'], [/cuchill|hacha|rebanar|santoku|tabla de bambu/, 'cuchillos'], [/tazones/, 'tazones'],
    [/olla|sistema de cocina|tapa (pequena|mediana|grande|alta)/, 'ollas_novel'],
  ];
  for (const [re, k] of reglas) if (re.test(n)) return k;
  return null;
}
