const pool = require('../db');

async function ConsultarCalcomania(req, res) {
    try {
        // Obtenemos los IDs de los roles "gerente" y "vendedor" de la base de datos
        // Esto es más robusto que codificarlos directamente, en caso de que los IDs cambien.
        const [roles] = await pool.execute(
            `SELECT id_rol, nombre FROM ROL WHERE nombre IN ('gerente', 'vendedor')`
        );

        const rolesPermitidosIds = roles.map(rol => rol.id_rol);

        // Si no se encuentran los roles, o no hay IDs para filtrar, podríamos enviar un error
        // o simplemente no devolver calcomanías, dependiendo del comportamiento deseado.
        if (rolesPermitidosIds.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'No se encontraron IDs de rol para gerente o vendedor. Verifique la tabla ROL.'
            });
        }

        const [calcomanias] = await pool.execute(
            `SELECT
                c.id_calcomania,
                c.nombre,
                c.url_archivo,
                c.precio_unidad,
                c.precio_descuento,
                c.stock_pequeno,
                c.stock_mediano,
                c.stock_grande,
                c.estado,
                u.nombre AS nombre_usuario
            FROM
                calcomania c
            INNER JOIN
                usuario u ON c.fk_id_usuario = u.id_usuario
            INNER JOIN
                usuario_rol ur ON u.id_usuario = ur.fk_id_usuario
            WHERE
                ur.id_rol IN (?) -- Filtrar por los roles permitidos
            ORDER BY
                c.fecha_subida DESC, c.id_calcomania DESC`,
            [rolesPermitidosIds] // Pasamos el array de IDs para la cláusula IN
        );

        // Formatear los datos para incluir el estado como texto y asegurar todos los campos
        const calcomaniasFormateadas = calcomanias.map(calcomania => ({
            id_calcomania: calcomania.id_calcomania,
            nombre: calcomania.nombre,
            url_archivo: calcomania.url_archivo,
            precio_unidad: calcomania.precio_unidad,
            precio_descuento: calcomania.precio_descuento,
            stock_pequeno: calcomania.stock_pequeno,
            stock_mediano: calcomania.stock_mediano,
            stock_grande: calcomania.stock_grande,
            estado: calcomania.estado ? 'Activo' : 'Inactivo',
            nombre_usuario: calcomania.nombre_usuario
        }));

        return res.status(200).json({
            success: true,
            mensaje: 'Calcomanías consultadas exitosamente.',
            calcomanias: calcomaniasFormateadas
        });

    } catch (error) {
        console.error('Error consultando calcomanías:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al consultar calcomanías.'
        });
    }
}

module.exports = { ConsultarCalcomania };