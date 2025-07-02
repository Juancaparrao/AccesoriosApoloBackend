const pool = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { enviarCorreoBienvenida } = require('../templates/UsuarioNoRegistrado');

function generarContrasenaSegura() {
    return crypto.randomBytes(8).toString('hex');
}

async function DireccionEnvio(req, res) {
    let connection;
    try {
        console.log("=== DEBUG BACKEND - Función DireccionEnvio ===");
        console.log("DEBUG: req.user (desde token, si existe):", req.user);

        const {
            nombre,
            cedula,
            telefono,
            correo,
            direccion,
            informacion_adicional,
            carrito
        } = req.body;

        console.log("DEBUG 1: Datos recibidos en req.body:", JSON.stringify(req.body, null, 2));

        if (!nombre || !cedula || !telefono || !correo || !direccion) {
            console.log("DEBUG ERROR: Datos de envío obligatorios faltantes.");
            return res.status(400).json({
                success: false,
                mensaje: 'Los campos nombre, cédula, teléfono, correo y dirección son obligatorios.'
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        let fk_id_usuario;
        let esNuevoRegistro = false;
        let contrasenaGenerada = null;
        let carritoDesdeDB = [];

        // --- Lógica de manejo de usuario (autenticado vs. invitado) ---
        // (Esta sección no necesita cambios y se mantiene igual)
        if (req.user && req.user.id_usuario) {
            fk_id_usuario = req.user.id_usuario;
            // ... (código existente para usuario logueado)
             console.log("Usuario AUTENTICADO. ID:", req.user.id_usuario);
            // ... (resto del código de manejo de usuario logueado)
            const [dbCartItems] = await connection.execute( `SELECT cc.FK_referencia_producto AS id_producto, cc.FK_id_calcomania AS id_calcomania, cc.cantidad, cc.tamano, CASE WHEN cc.FK_referencia_producto IS NOT NULL THEN 'producto' WHEN cc.FK_id_calcomania IS NOT NULL THEN 'calcomania' ELSE NULL END AS tipo FROM carrito_compras cc WHERE cc.FK_id_usuario = ?`, [fk_id_usuario] );
            carritoDesdeDB = dbCartItems;
            console.log(`Carrito cargado desde DB para usuario logeado ID ${fk_id_usuario}:`, JSON.stringify(carritoDesdeDB, null, 2));
        } else {
             // ... (código existente para usuario invitado)
        }
        
        if (!carritoDesdeDB || !Array.isArray(carritoDesdeDB) || carritoDesdeDB.length === 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, mensaje: 'No se encontraron artículos en su carrito. Por favor, añada artículos antes de continuar.' });
        }


        // ======================================================================
        // --- INICIO DE LA CORRECCIÓN ---
        // Lógica para buscar una factura pendiente existente o crear una nueva.
        // ======================================================================
        
        let id_factura;

        // 1. Buscar una factura reciente en estado 'Pendiente' para este usuario.
        // Usamos un intervalo de 15 minutos para considerar una factura como "activa" en el proceso de checkout.
        const [existingFacturas] = await connection.execute(
            `SELECT id_factura FROM factura 
             WHERE fk_id_usuario = ? 
             AND estado_pedido = 'Pendiente' 
             AND fecha_venta >= NOW() - INTERVAL 15 MINUTE
             ORDER BY fecha_venta DESC 
             LIMIT 1`,
            [fk_id_usuario]
        );

        if (existingFacturas.length > 0) {
            // 2. Si se encuentra, la ACTUALIZAMOS en lugar de crear una nueva.
            id_factura = existingFacturas[0].id_factura;
            console.log(`Factura pendiente encontrada (ID: ${id_factura}). Actualizando datos de envío.`);
            
            await connection.execute(
                `UPDATE factura 
                 SET direccion = ?, informacion_adicional = ?, valor_envio = ?
                 WHERE id_factura = ?`,
                [direccion, informacion_adicional || null, 14900.00, id_factura]
            );

        } else {
            // 3. Si no se encuentra, CREAMOS una nueva como se hacía antes.
            const [facturaResult] = await connection.execute(
                `INSERT INTO factura (fk_id_usuario, fecha_venta, direccion, informacion_adicional, valor_total, metodo_pago, valor_envio, estado_pedido)
                 VALUES (?, NOW(), ?, ?, ?, ?, ?, 'Pendiente')`,
                [fk_id_usuario, direccion, informacion_adicional || null, 0.00, null, 14900.00]
            );
            id_factura = facturaResult.insertId;
            console.log(`Nueva factura (ID: ${id_factura}) creada con datos de envío para usuario ID: ${fk_id_usuario}.`);
        }

        // ======================================================================
        // --- FIN DE LA CORRECCIÓN ---
        // ======================================================================

        // --- Lógica para poblar el carrito si es invitado (sin cambios) ---
        if (!req.user || esNuevoRegistro) {
            // ... (código existente para repoblar el carrito)
        } else {
             console.log(`Usuario logeado. Se asume que el carrito en la DB es la fuente de verdad y no se repobló.`);
        }

        await connection.commit();
        console.log("DEBUG: Transacción de DireccionEnvio completada y datos guardados en DB.");

        res.status(200).json({
            success: true,
            mensaje: 'Información de envío y factura inicial procesadas. Puedes continuar con la compra.',
            // Se devuelve el ID de la factura, ya sea la actualizada o la nueva
            id_factura_creada: id_factura, 
            fk_id_usuario_para_compra: fk_id_usuario,
            // ... (resto de la respuesta)
        });

    } catch (error) {
        // ... (bloque catch sin cambios)
    } finally {
        if (connection) {
            connection.release();
            console.log("DEBUG: Conexión a la DB liberada.");
        }
    }
}

module.exports = {
    DireccionEnvio
};