const pool = require('../../db');

// Función para obtener top 5 productos con más stock y top 5 con menos stock
const obtenerTopProductosStock = async (req, res) => {
    try {
        // Query para productos con más stock
        const queryMasStock = `
            SELECT 
                p.nombre,
                p.stock
            FROM producto p
            WHERE p.estado = true
            ORDER BY p.stock DESC
            LIMIT 5
        `;

        // Query para productos con menos stock
        const queryMenosStock = `
            SELECT 
                p.nombre,
                p.stock
            FROM producto p
            WHERE p.estado = true
            ORDER BY p.stock ASC
            LIMIT 5
        `;

        // Ejecutar ambas consultas
        const [productosMasStock, productosMenosStock] = await Promise.all([
            pool.query(queryMasStock),
            pool.query(queryMenosStock)
        ]);

        // Formatear respuesta
        const topMasStock = productosMasStock.map(producto => ({
            nombre: producto.nombre,
            stock: producto.stock
        }));

        const topMenosStock = productosMenosStock.map(producto => ({
            nombre: producto.nombre,
            stock: producto.stock
        }));

        res.status(200).json({
            success: true,
            message: 'Top productos por stock obtenidos exitosamente',
            data: {
                mas_stock: topMasStock,
                menos_stock: topMenosStock
            }
        });

    } catch (error) {
        console.error('Error al obtener top productos por stock:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

module.exports = {
    obtenerTopProductosStock
};