const pool = require('../db');

async function ConsultarProducto(req, res) {
  try {
    const [productos] = await pool.execute(`
      SELECT 
        p.referencia,
        p.nombre,
        p.descripcion,
        p.talla,
        p.marca, -- NUEVO
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
      LEFT JOIN producto_imagen pi ON p.referencia = pi.FK_referencia_producto
      GROUP BY p.referencia
      ORDER BY p.nombre ASC
    `);

    const formatearNumero = (valor) => {
      return new Intl.NumberFormat('es-CO').format(Number(valor));
    };

    const productosFormateados = productos.map(p => ({
      referencia: p.referencia,
      nombre: p.nombre,
      descripcion: p.descripcion,
      talla: p.talla,
      marca: p.marca || null, // NUEVO
      stock: p.stock,
      precio_unidad: formatearNumero(p.precio_unidad),
      descuento: Number(p.descuento),
      precio_descuento: formatearNumero(p.precio_descuento),
      categoria: p.nombre_categoria,
      subcategoria: p.nombre_subcategoria,
      estado: p.estado ? 'Activo' : 'Inactivo',
      imagenes: p.imagenes ? p.imagenes.split(',') : []
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
