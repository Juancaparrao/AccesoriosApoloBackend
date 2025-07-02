// /controllers/calificacionController.js

const pool = require('../db');

/**
 * Manejador de ruta para que un usuario registre o actualice la calificación de un producto.
 * Recalcula y actualiza el promedio de calificación del producto.
 */
async function registrarCalificacion(req, res) {
    let connection;
    try {
        // 1. Obtener datos del token y del cuerpo de la solicitud
        const userId = req.usuario.id_usuario;
        const { referencia, puntuacion } = req.body;

        // 2. Validación rigurosa de las entradas
        if (!referencia || puntuacion === undefined) {
            return res.status(400).json({ success: false, message: 'La referencia del producto y la puntuación son requeridas.' });
        }
        if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) {
            return res.status(400).json({ success: false, message: 'La puntuación debe ser un número entero entre 1 y 5.' });
        }

        // 3. Iniciar transacción
        connection = await pool.getConnection();
        await connection.beginTransaction();
        console.log(`[Calificación] Iniciando transacción para calificar producto ${referencia} por usuario ${userId}`);

        // 4. Verificar que el producto exista (paso de seguridad)
        const [productoRows] = await connection.execute('SELECT referencia FROM producto WHERE referencia = ?', [referencia]);
        if (productoRows.length === 0) {
            throw new Error(`El producto con referencia '${referencia}' no existe.`);
        }

        // 5. Insertar la nueva calificación o actualizar la existente (atómico)
        const insertOrUpdateSql = `
            INSERT INTO CALIFICACION (FK_id_usuario, FK_referencia_producto, puntuacion, fecha_calificacion)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE puntuacion = VALUES(puntuacion), fecha_calificacion = NOW();
        `;
        await connection.execute(insertOrUpdateSql, [userId, referencia, puntuacion]);
        console.log(`[Calificación] Calificación de ${puntuacion} estrellas guardada para producto ${referencia}`);

        // 6. Recalcular el promedio de calificación para ESE producto
        const [promedioResult] = await connection.execute(
            'SELECT AVG(puntuacion) as nuevoPromedio FROM CALIFICACION WHERE FK_referencia_producto = ?',
            [referencia]
        );
        const nuevoPromedio = promedioResult[0].nuevoPromedio || 0;
        // Se formatea a un solo decimal
        const promedioFormateado = parseFloat(nuevoPromedio).toFixed(1); 
        
        console.log(`[Calificación] Nuevo promedio para ${referencia} es: ${promedioFormateado}`);

        // 7. Actualizar el promedio en la tabla PRODUCTO
        await connection.execute(
            'UPDATE producto SET promedio_calificacion = ? WHERE referencia = ?',
            [promedioFormateado, referencia]
        );

        // 8. Confirmar la transacción
        await connection.commit();
        console.log(`[Calificación] Transacción completada exitosamente.`);

        res.status(201).json({ success: true, message: 'Gracias por tu calificación.' });

    } catch (error) {
        // Si algo falla, revertir todos los cambios
        if (connection) await connection.rollback();
        console.error('❌ Error al registrar calificación:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al procesar la calificación.' });
    } finally {
        // Liberar la conexión para que otros la puedan usar
        if (connection) connection.release();
    }
}

module.exports = {
    registrarCalificacion
};