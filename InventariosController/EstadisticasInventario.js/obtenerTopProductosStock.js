const pool = require('../../db');

// Función para obtener top 5 productos con MÁS stock
const obtenerTopProductosMasStock = async (req, res) => {
    try {
        const query = `
            SELECT 
                p.nombre,
                p.stock
            FROM producto p
            WHERE p.estado = true
            ORDER BY p.stock DESC
            LIMIT 5
        `;

        const resultado = await pool.query(query);
        
        // Extraer las filas correctamente
        const productos = resultado[0] || resultado;

        // Formatear respuesta
        const topMasStock = productos.map(producto => ({
            nombre: producto.nombre,
            stock: producto.stock
        }));

        res.status(200).json({
            success: true,
            message: 'Top 5 productos con más stock obtenidos exitosamente',
            data: topMasStock
        });

    } catch (error) {
        console.error('Error al obtener productos con más stock:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Función para obtener top 5 productos con MENOS stock
const obtenerTopProductosMenosStock = async (req, res) => {
    try {
        const query = `
            SELECT 
                p.nombre,
                p.stock
            FROM producto p
            WHERE p.estado = true
            ORDER BY p.stock ASC
            LIMIT 5
        `;

        const resultado = await pool.query(query);
        
        // Extraer las filas correctamente
        const productos = resultado[0] || resultado;

        // Formatear respuesta
        const topMenosStock = productos.map(producto => ({
            nombre: producto.nombre,
            stock: producto.stock
        }));

        res.status(200).json({
            success: true,
            message: 'Top 5 productos con menos stock obtenidos exitosamente',
            data: topMenosStock
        });

    } catch (error) {
        console.error('Error al obtener productos con menos stock:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

module.exports = {
    obtenerTopProductosMasStock,
    obtenerTopProductosMenosStock
};