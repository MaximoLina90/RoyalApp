export type Rol = 'vendedor' | 'admin';
export interface Profile { id: string; nombre: string; email: string; celular: string | null; codigo_vendedor: string | null; rol: Rol; created_at: string }
export interface Categoria { id: number; slug: string; nombre: string; descripcion: string | null; orden: number }
export interface Producto { id: number; categoria_id: number; codigo: string | null; nombre: string; descripcion: string | null; precio: number; imagen_url: string | null; orden: number; activo: boolean }
export interface ItemPedido { id: number; nombre: string; codigo: string | null; precio: number; cantidad: number }
export interface Pedido { id: string; usuario_id: string; numero: number; cliente: string | null; total: number; entrega: number; porcentaje_entrega: number; cuotas: number; cuota: number; pago: 'Contado' | 'Financiado'; items: ItemPedido[]; created_at: string }
export type Evento = 'Demo' | 'Entrevista' | 'Capacitación' | 'Servicio' | 'Otro';
export const EVENTOS: Evento[] = ['Demo', 'Entrevista', 'Capacitación', 'Servicio', 'Otro'];
export interface Tarea { id: string; usuario_id: string; fecha: string; horario: string | null; evento: Evento; titulo: string; ubicacion: string | null; notas: string | null }
export interface ConfigPublica { factores: Record<string, number>; dias_mes: number }
export type EstadoMk = 'Nuevo' | 'Usado' | 'Reacondicionado';
export const ESTADOS_MK: EstadoMk[] = ['Nuevo', 'Usado', 'Reacondicionado'];
export const CATEGORIAS_MK = ['Ollas y sartenes', 'Cuchillería', 'Electrodomésticos', 'Filtros de agua', 'Accesorios', 'Otro'];
export interface MarketplaceItem { id: string; usuario_id: string; titulo: string; descripcion: string | null; categoria: string; estado: EstadoMk; precio: number; imagen_url: string | null; contacto: string | null; ubicacion: string | null; activo: boolean; created_at: string; vendedor_nombre: string | null }
