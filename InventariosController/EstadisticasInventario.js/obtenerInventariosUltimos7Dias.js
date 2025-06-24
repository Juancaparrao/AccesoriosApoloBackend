const pool = require('../../db');

// Función para obtener cantidad de unidades de los últimos 7 inventarios del sistema
const obtenerInventariosUltimos7Dias = async (req, res) => {
    try {
        const query = `
            SELECT 
                fecha_creacion,
                cantidad_unidades
            FROM inventario 
            WHERE responsable = 'Sistema'
            ORDER BY fecha_creacion DESC
            LIMIT 7
        `;

        const resultado = await pool.query(query);

        // Formatear respuesta ordenando del más antiguo al más reciente para mejor visualización
        const inventarios = resultado.reverse().map(inventario => ({
            fecha: inventario.fecha_creacion,
            cantidad_unidades: inventario.cantidad_unidades
        }));

        res.status(200).json({
            success: true,
            message: 'Inventarios de los últimos 7 días obtenidos exitosamente',
            data: inventarios
        });

    } catch (error) {
        console.error('Error al obtener inventarios de los últimos 7 días:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

module.exports = {
    obtenerInventariosUltimos7Dias
};