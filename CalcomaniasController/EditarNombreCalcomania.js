const pool = require('../db');

async function EditarNombreCalcomania(req, res) {
  try {
    const { id_calcomania } = req.params;
    const { nombre } = req.body;

    // Validar que se proporcione el ID
    if (!id_calcomania) {
      return res.status(400).json({
        success: false,
        mensaje: 'El ID de la calcomanía es requerido.'
      });
    }

    // Validar que se proporcione el nuevo nombre
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({
        success: false,
        mensaje: 'El nombre de la calcomanía es requerido.'
      });
    }

    // Verificar si la calcomanía existe
    const [calcomaniaExistente] = await pool.execute(
      'SELECT id_calcomania, nombre FROM calcomania WHERE id_calcomania = ?',
      [id_calcomania]
    );

    if (calcomaniaExistente.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'La calcomanía no existe.'
      });
    }

    const nombreAnterior = calcomaniaExistente[0].nombre;
    const nombreNuevo = nombre.trim();

    // Verificar si el nombre ya es el mismo
    if (nombreAnterior === nombreNuevo) {
      return res.status(400).json({
        success: false,
        mensaje: 'El nuevo nombre es igual al nombre actual.'
      });
    }

    // Actualizar el nombre de la calcomanía
    const [resultado] = await pool.execute(
      'UPDATE calcomania SET nombre = ? WHERE id_calcomania = ?',
      [nombreNuevo, id_calcomania]
    );

    if (resultado.affectedRows === 0) {
      return res.status(500).json({
        success: false,
        mensaje: 'No se pudo actualizar el nombre de la calcomanía.'
      });
    }

    return res.status(200).json({
      success: true,
      mensaje: 'Nombre de la calcomanía actualizado exitosamente.',
      datos: {
        id_calcomania: parseInt(id_calcomania),
        nombre_anterior: nombreAnterior,
        nombre_nuevo: nombreNuevo
      }
    });

  } catch (error) {
    console.error('Error actualizando nombre de calcomanía:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor.'
    });
  }
}

module.exports = { EditarNombreCalcomania };