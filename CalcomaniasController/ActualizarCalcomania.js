const pool = require('../db');
const cloudinary = require('../cloudinary');

async function ObtenerDatosCalcomania(req, res) {
  // ... (Esta función ya está correcta para el formato y porcentaje)
  const { id_calcomania } = req.body;

  try {
    if (!id_calcomania) {
      return res.status(400).json({
        success: false,
        mensaje: 'El ID de calcomanía es requerido para obtener sus datos.'
      });
    }

    const [[calcomania]] = await pool.execute(
      `SELECT c.id_calcomania, c.nombre, c.formato, c.tamano_archivo,
               c.fecha_subida, c.url_archivo, c.fk_id_usuario, u.nombre AS nombre_usuario,
               c.precio_unidad, c.precio_descuento, c.tamano_x, c.tamano_y,
               c.stock_pequeno, c.stock_mediano, c.stock_grande, c.estado
         FROM calcomania c
         JOIN usuario u ON c.fk_id_usuario = u.id_usuario
         WHERE c.id_calcomania = ?`,
      [id_calcomania]
    );

    if (!calcomania) {
      return res.status(404).json({
        success: false,
        mensaje: 'Calcomanía no encontrada.'
      });
    }

    const formatter = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    const precioUnidadNum = parseFloat(calcomania.precio_unidad);
    const precioDescuentoNum = parseFloat(calcomania.precio_descuento);

    let porcentaje_descuento = 0;
    if (
        !isNaN(precioUnidadNum) && precioUnidadNum > 0 &&
        !isNaN(precioDescuentoNum) && precioDescuentoNum < precioUnidadNum
    ) {
      porcentaje_descuento = ((precioUnidadNum - precioDescuentoNum) / precioUnidadNum) * 100;
      porcentaje_descuento = parseFloat(porcentaje_descuento.toFixed(2));
    }

    const formattedCalcomania = {
      ...calcomania,
      precio_unidad: formatter.format(precioUnidadNum),
      precio_descuento: formatter.format(precioDescuentoNum),
      porcentaje_descuento: porcentaje_descuento
    };

    const [usuarios] = await pool.execute(
      `SELECT id_usuario, nombre FROM usuario WHERE estado = 1`
    );

    return res.status(200).json({
      success: true,
      calcomania: formattedCalcomania,
      usuarios
    });

  } catch (error) {
    console.error('❌ Error al obtener datos de la calcomanía:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al obtener los datos de la calcomanía.'
    });
  }
}


async function ActualizarCalcomania(req, res) {
  try {
    const {
      id_calcomania,
      nombre,
      fk_id_usuario,
      // No desestructuramos precio_unidad y precio_descuento aquí directamente
      // para poder procesarlos antes
      stock_pequeno,
      stock_mediano,
      stock_grande,
      estado
    } = req.body;

    let { precio_unidad, precio_descuento } = req.body; // Los obtenemos por separado para limpiar


    // Validar que el ID de calcomanía es requerido
    if (!id_calcomania) {
      return res.status(400).json({
        success: false,
        mensaje: 'El ID de calcomanía es requerido para la actualización.'
      });
    }

    // Obtener la calcomanía actual para comparar y mantener valores si no se proporcionan nuevos
    const [resultado] = await pool.execute(`
      SELECT * FROM calcomania WHERE id_calcomania = ?
    `, [id_calcomania]);

    if (resultado.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Calcomanía no encontrada.'
      });
    }

    const calcomaniaActual = resultado[0];

    // --- ¡INICIO DEL CAMBIO CLAVE PARA SANITIZAR PRECIOS! ---
    // Si precio_unidad o precio_descuento vienen en la solicitud, limpiarlos
    if (precio_unidad !== undefined) {
        precio_unidad = precio_unidad.toString().replace(/[^\d.-]/g, ''); // Elimina todo lo que no sea dígito, punto o guion
        precio_unidad = parseFloat(precio_unidad);
        if (isNaN(precio_unidad)) { // Si después de limpiar no es un número válido
            return res.status(400).json({
                success: false,
                mensaje: 'El valor de precio_unidad no es un número válido.'
            });
        }
    }

    if (precio_descuento !== undefined) {
        precio_descuento = precio_descuento.toString().replace(/[^\d.-]/g, ''); // Elimina todo lo que no sea dígito, punto o guion
        precio_descuento = parseFloat(precio_descuento);
        if (isNaN(precio_descuento)) { // Si después de limpiar no es un número válido
            return res.status(400).json({
                success: false,
                mensaje: 'El valor de precio_descuento no es un número válido.'
            });
        }
    }
    // --- ¡FIN DEL CAMBIO CLAVE! ---


    // Variables a actualizar, inicializadas con los valores actuales o los proporcionados en la solicitud
    let updatedNombre = nombre !== undefined ? nombre : calcomaniaActual.nombre;
    let updatedFkIdUsuario = fk_id_usuario !== undefined ? fk_id_usuario : calcomaniaActual.fk_id_usuario;
    let updatedUrlArchivo = calcomaniaActual.url_archivo;
    let updatedFormato = calcomaniaActual.formato;
    let updatedTamanoArchivo = calcomaniaActual.tamano_archivo;
    let updatedFechaSubida = calcomaniaActual.fecha_subida;
    
    // Usamos los precios *sanitizados* aquí
    let updatedPrecioUnidad = precio_unidad !== undefined ? precio_unidad : calcomaniaActual.precio_unidad;
    let updatedPrecioDescuento = precio_descuento !== undefined ? precio_descuento : calcomaniaActual.precio_descuento;
    
    let updatedStockPequeno = stock_pequeno !== undefined ? stock_pequeno : calcomaniaActual.stock_pequeno;
    let updatedStockMediano = stock_mediano !== undefined ? stock_mediano : calcomaniaActual.stock_mediano;
    let updatedStockGrande = stock_grande !== undefined ? stock_grande : calcomaniaActual.stock_grande;
    let updatedEstado = estado !== undefined ? estado : calcomaniaActual.estado;

    const updatedTamanoX = '5';
    const updatedTamanoY = '5';

    // Si viene una imagen nueva, la sube a Cloudinary y actualiza metadatos
    if (req.file?.path) {
      updatedUrlArchivo = req.file.path;
      updatedFormato = req.file.mimetype.split('/')[1];
      updatedTamanoArchivo = `${(req.file.size / 1024).toFixed(2)} KB`;
      updatedFechaSubida = new Date().toISOString().split('T')[0];
    }

    // Verificar que el usuario existe si se está cambiando
    if (fk_id_usuario !== undefined && fk_id_usuario !== calcomaniaActual.fk_id_usuario) {
      const [usuario] = await pool.execute(
        'SELECT id_usuario FROM usuario WHERE id_usuario = ? AND estado = 1',
        [fk_id_usuario]
      );

      if (usuario.length === 0) {
        return res.status(404).json({
          success: false,
          mensaje: 'Usuario no encontrado o inactivo para la asignación.'
        });
      }
    }

    // Actualizar la calcomanía en la base de datos con todos los campos relevantes
    await pool.execute(`
      UPDATE calcomania
      SET
        nombre = ?,
        formato = ?,
        tamano_archivo = ?,
        fecha_subida = ?,
        url_archivo = ?,
        fk_id_usuario = ?,
        precio_unidad = ?,
        precio_descuento = ?,
        tamano_x = ?,
        tamano_y = ?,
        stock_pequeno = ?,
        stock_mediano = ?,
        stock_grande = ?,
        estado = ?
      WHERE id_calcomania = ?
    `, [
      updatedNombre,
      updatedFormato,
      updatedTamanoArchivo,
      updatedFechaSubida,
      updatedUrlArchivo,
      updatedFkIdUsuario,
      updatedPrecioUnidad, // Usamos la variable ya sanitizada
      updatedPrecioDescuento, // Usamos la variable ya sanitizada
      updatedTamanoX,
      updatedTamanoY,
      updatedStockPequeno,
      updatedStockMediano,
      updatedStockGrande,
      updatedEstado,
      id_calcomania
    ]);

    return res.status(200).json({
      success: true,
      mensaje: 'Calcomanía actualizada correctamente.',
      calcomania: {
        id_calcomania,
        nombre: updatedNombre,
        formato: updatedFormato,
        tamano_archivo: updatedTamanoArchivo,
        fecha_subida: updatedFechaSubida,
        url_archivo: updatedUrlArchivo,
        fk_id_usuario: updatedFkIdUsuario,
        precio_unidad: updatedPrecioUnidad,
        precio_descuento: updatedPrecioDescuento,
        tamano_x: updatedTamanoX,
        tamano_y: updatedTamanoY,
        stock_pequeno: updatedStockPequeno,
        stock_mediano: updatedStockMediano,
        stock_grande: updatedStockGrande,
        estado: updatedEstado
      }
    });

  } catch (error) {
    console.error('Error al actualizar calcomanía:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al actualizar la calcomanía.'
    });
  }
}

module.exports = {
  ObtenerDatosCalcomania,
  ActualizarCalcomania
};