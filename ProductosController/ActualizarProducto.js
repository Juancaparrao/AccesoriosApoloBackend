const pool = require('../db');
const fs = require('fs');
const path = require('path');

// Formateador de números con puntos de miles (estilo colombiano)
const formateador = new Intl.NumberFormat('es-CO');

async function ObtenerProductos(req, res) {
  const { referencia } = req.query;

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
        p.FK_id_categoria,
        p.FK_id_subcategoria,
        c.nombre_categoria AS categoria,
        s.nombre_subcategoria AS subcategoria,
        GROUP_CONCAT(pi.url_imagen) AS imagenes
      FROM producto p
      JOIN categoria c ON p.FK_id_categoria = c.id_categoria
      JOIN subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
      LEFT JOIN producto_imagen pi ON pi.FK_referencia_producto = p.referencia
      WHERE p.referencia = ?
      GROUP BY p.referencia
    `, [referencia]);

    if (productos.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Producto no encontrado'
      });
    }

    const producto = productos[0];

    const [categorias] = await pool.execute(`
      SELECT id_categoria, nombre_categoria FROM categoria
    `);

    const [subcategorias] = await pool.execute(`
      SELECT id_subcategoria, nombre_subcategoria 
      FROM subcategoria 
      WHERE FK_id_categoria = ?
    `, [producto.FK_id_categoria]);

    const productoFormateado = {
      referencia: producto.referencia,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      talla: producto.talla,
      stock: Number(producto.stock),
      precio_unidad: formateador.format(Number(producto.precio_unidad)),
      descuento: formateador.format(Number(producto.descuento)),
      precio_descuento: formateador.format(Number(producto.precio_descuento)),
      categoria: {
        seleccionada: {
          id: producto.FK_id_categoria,
          nombre: producto.categoria
        },
        todas: categorias
      },
      subcategoria: {
        seleccionada: {
          id: producto.FK_id_subcategoria,
          nombre: producto.subcategoria
        },
        todas: subcategorias
      },
      imagenes: producto.imagenes ? producto.imagenes.split(',') : []
    };

    return res.status(200).json({
      success: true,
      producto: productoFormateado
    });

  } catch (error) {
    console.error('Error al obtener el producto:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener el producto'
    });
  }
}

async function ActualizarProducto(req, res) {
  const {
    referencia,
    nuevaReferencia,
    nombre,
    descripcion,
    talla,
    precio_unidad,
    descuento,
    FK_id_categoria,
    FK_id_subcategoria,
    imagenesEliminadas
  } = req.body;

  const archivos = req.files;

  try {
    const [productoExistente] = await pool.execute(
      'SELECT * FROM producto WHERE referencia = ?',
      [referencia]
    );

    if (productoExistente.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Producto no encontrado'
      });
    }

    const precioUnidadNum = parseFloat(precio_unidad);
    const descuentoNum = parseFloat(descuento);

    if (isNaN(precioUnidadNum) || isNaN(descuentoNum)) {
      return res.status(400).json({
        success: false,
        mensaje: 'precio_unidad y descuento deben ser números válidos.'
      });
    }

    const precioDesc = precioUnidadNum - (precioUnidadNum * (descuentoNum / 100));

    if (imagenesEliminadas) {
      try {
        const imagenesAEliminar = JSON.parse(imagenesEliminadas);
        
        for (const imagenUrl of imagenesAEliminar) {
          try {
            const nombreArchivo = path.basename(imagenUrl);
            const rutaCompleta = path.join(__dirname, '..', 'uploads', nombreArchivo);
            if (fs.existsSync(rutaCompleta)) {
              fs.unlinkSync(rutaCompleta);
              console.log(`Archivo eliminado: ${rutaCompleta}`);
            } else {
              console.log(`Archivo no encontrado: ${rutaCompleta}`);
            }
          } catch (errorArchivo) {
            console.error(`Error al eliminar archivo ${imagenUrl}:`, errorArchivo);
          }

          await pool.execute(
            `DELETE FROM producto_imagen 
             WHERE FK_referencia_producto = ? AND url_imagen = ?`,
            [referencia, imagenUrl]
          );
          console.log(`Imagen eliminada de BD: ${imagenUrl}`);
        }
      } catch (errorJson) {
        console.error('Error al procesar imágenes eliminadas:', errorJson);
        return res.status(400).json({
          success: false,
          mensaje: 'Error al procesar las imágenes eliminadas'
        });
      }
    }

    await pool.execute(
      `UPDATE producto 
       SET referencia = ?, nombre = ?, descripcion = ?, talla = ?, 
           precio_unidad = ?, descuento = ?, precio_descuento = ?, 
           FK_id_categoria = ?, FK_id_subcategoria = ?
       WHERE referencia = ?`,
      [
        nuevaReferencia || referencia,
        nombre,
        descripcion,
        talla,
        precioUnidadNum,
        descuentoNum,
        precioDesc,
        FK_id_categoria,
        FK_id_subcategoria,
        referencia
      ]
    );

    if (nuevaReferencia && nuevaReferencia !== referencia) {
      await pool.execute(
        `UPDATE producto_imagen 
         SET FK_referencia_producto = ?
         WHERE FK_referencia_producto = ?`,
        [nuevaReferencia, referencia]
      );
    }

    if (archivos && archivos.length > 0) {
      for (const file of archivos) {
        const url = file.path;
        await pool.execute(
          `INSERT INTO producto_imagen (FK_referencia_producto, url_imagen) VALUES (?, ?)`,
          [nuevaReferencia || referencia, url]
        );
      }
    }

    const precioDescuentoFormateado = formateador.format(precioDesc);

return res.status(200).json({
  success: true,
  mensaje: 'Producto actualizado correctamente.',
  producto: {
    referencia: nuevaReferencia || referencia,
    nombre,
    precio_unidad: formateador.format(precioUnidadNum),
    descuento: formateador.format(descuentoNum),
    precio_descuento: precioDescuentoFormateado
  }
});


  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al actualizar el producto'
    });
  }
}

module.exports = { ActualizarProducto, ObtenerProductos };
