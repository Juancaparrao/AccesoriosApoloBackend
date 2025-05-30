const pool = require('../db');

async function BuscarProductoPorReferencia(req, res) {
  try {
    const { filtro } = req.query;

    if (!filtro || filtro.trim() === '') {
      return res.status(400).json({
        success: false,
        mensaje: 'Debe proporcionar un filtro para buscar.'
      });
    }

    const [productos] = await pool.execute(
      `SELECT 
         p.referencia, 
         p.nombre, 
         p.descripcion, 
         p.talla, 
         p.stock, 
         p.url_archivo, 
         p.precio_unidad, 
         p.descuento, 
         p.precio_descuento, 
         p.estado,
         c.nombre AS categoria,
         s.nombre AS subcategoria
       FROM producto p
       JOIN categoria c ON p.FK_id_categoria = c.id_categoria
       JOIN subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
       WHERE p.referencia LIKE ?`,
      [`${filtro}%`]
    );

    const productosFormateados = productos.map(producto => ({
      referencia: producto.referencia,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      talla: producto.talla,
      stock: producto.stock,
      url_archivo: producto.url_archivo,
      precio_unidad: producto.precio_unidad,
      descuento: producto.descuento,
      precio_descuento: producto.precio_descuento,
      categoria: producto.categoria,
      subcategoria: producto.subcategoria,
      estado: producto.estado ? 'Activo' : 'Inactivo'
    }));

    return res.status(200).json({
      success: true,
      productos: productosFormateados
    });

  } catch (error) {
    console.error('Error al buscar producto por referencia:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al buscar productos.'
    });
  }
}

module.exports = { BuscarProductoPorReferencia };
