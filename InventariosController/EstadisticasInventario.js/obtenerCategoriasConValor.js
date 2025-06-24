const pool = require('../../db');

// Función para obtener categorías con el valor total de productos
const obtenerCategoriasConValor = async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id_categoria,
                c.nombre_categoria,
                COALESCE(SUM(
                    CASE 
                        WHEN p.precio_descuento IS NOT NULL AND p.precio_descuento > 0
                        THEN p.precio_descuento * p.stock
                        ELSE p.precio_unidad * p.stock
                    END
                ), 0) as valor_total
            FROM CATEGORIA c
            LEFT JOIN PRODUCTO p ON c.id_categoria = p.FK_id_categoria 
                AND p.estado = true
            WHERE c.estado = true
            GROUP BY c.id_categoria, c.nombre_categoria
            ORDER BY c.nombre_categoria ASC
        `;

        const resultado = await pool.query(query); // Cambiado de 'db' a 'pool'

        const categorias = resultado.map(categoria => ({
            id: categoria.id_categoria,
            nombre: categoria.nombre_categoria,
            valor: parseFloat(categoria.valor_total || 0).toFixed(2)
        }));

        res.status(200).json({
            success: true,
            message: 'Categorías obtenidas exitosamente',
            data: categorias
        });

    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

module.exports = {
    obtenerCategoriasConValor
};