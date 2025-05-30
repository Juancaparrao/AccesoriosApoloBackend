const pool = require('../db');

async function ConsultarProducto(req, res) {
  try {
    const [productos] = await pool.execute(`
  SELECT 
    p.referencia,
    p.nombre,
    p.descripcion,
    p.talla,
    p.stock,
    p.precio_unidad,
    p.descuento,
    p.precio_descuento,
    p.estado,
    c.nombre_categoria,
    s.nombre_subcategoria,
    GROUP_CONCAT(pi.url_imagen) AS imagenes
  FROM producto p
  JOIN categoria c ON p.FK_id_categoria = c.id_categoria
  JOIN subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
  LEFT JOIN producto_imagen pi ON p.referencia = pi.FK_producto
  GROUP BY p.referencia
  ORDER BY p.nombre ASC
`);

const productosFormateados = productos.map(p => ({
  referencia: p.referencia,
  nombre: p.nombre,
  descripcion: p.descripcion,
  talla: p.talla,
  stock: p.stock,
  precio_unidad: `$${p.precio_unidad.toFixed(2)}`,
  descuento: `${p.descuento}%`,
  precio_descuento: `$${p.precio_descuento.toFixed(2)}`,
  categoria: p.nombre_categoria,
  subcategoria: p.nombre_subcategoria,
  estado: p.estado ? 'Activo' : 'Inactivo',
  imagenes: p.imagenes ? p.imagenes.split(',') : []  // <- convierte string a array
}));

    return res.status(200).json({
      success: true,
      productos: productosFormateados
    });

  } catch (error) {
    console.error('❌ Error al consultar productos:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener la lista de productos.'
    });
  }
}

module.exports = { ConsultarProducto };
