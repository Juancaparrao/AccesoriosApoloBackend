const pool = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
// Asegúrate de que la ruta a tu servicio de correo sea correcta
const { enviarCorreoBienvenida } = require('../templates/UsuarioNoRegistrado');

/**
 * @description Genera una contraseña aleatoria y segura para nuevos usuarios.
 * @returns {string} Una contraseña de 16 caracteres hexadecimales.
 */
function generarContrasenaSegura() {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * @description Procesa los datos de envío del usuario, maneja el registro de nuevos usuarios
 * y crea o actualiza una factura en estado 'Pendiente' para iniciar el proceso de pago.
 * @route POST /api/direccion-envio
 */
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

        // 1. Validación de campos obligatorios
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

        // 2. Manejo del Usuario (Autenticado vs. Invitado)
        if (req.user && req.user.id_usuario) {
            // --- Usuario AUTENTICADO ---
            console.log("Usuario AUTENTICADO. ID:", req.user.id_usuario);
            fk_id_usuario = req.user.id_usuario;

            // Se asume que el carrito en la DB es la fuente de verdad.
            const [dbCartItems] = await connection.execute(
                `SELECT
                    cc.FK_referencia_producto AS id_producto,
                    cc.FK_id_calcomania AS id_calcomania,
                    cc.cantidad,
                    cc.tamano,
                    CASE
                        WHEN cc.FK_referencia_producto IS NOT NULL THEN 'producto'
                        WHEN cc.FK_id_calcomania IS NOT NULL THEN 'calcomania'
                    END AS tipo
                FROM carrito_compras cc
                WHERE cc.FK_id_usuario = ?`,
                [fk_id_usuario]
            );
            carritoDesdeDB = dbCartItems;
            console.log(`Carrito cargado desde DB para usuario logeado ID ${fk_id_usuario}.`);

        } else {
            // --- Usuario NO AUTENTICADO (Invitado) ---
            console.log("Usuario NO AUTENTICADO. Intentando encontrar o registrar.");
            if (!carrito || !Array.isArray(carrito) || carrito.length === 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, mensaje: 'Para finalizar la compra como invitado, su carrito no puede estar vacío.' });
            }
            carritoDesdeDB = carrito;

            const [existingUserByEmail] = await connection.execute(
                `SELECT id_usuario FROM usuario WHERE correo = ?`,
                [correo]
            );

            if (existingUserByEmail.length > 0) {
                // El correo ya existe, asociamos la compra a ese usuario.
                fk_id_usuario = existingUserByEmail[0].id_usuario;
                console.log("Correo ya registrado, usuario no autenticado. Usando ID:", fk_id_usuario);
            } else {
                // El correo es nuevo. Se crea una cuenta automáticamente.
                console.log("Correo NO registrado en DB. Registrando nuevo usuario y generando contraseña.");
                esNuevoRegistro = true;

                // Generar y hashear la contraseña
                contrasenaGenerada = generarContrasenaSegura();
                const hashedPassword = await bcrypt.hash(contrasenaGenerada, 10);

                // Insertar el nuevo usuario con la contraseña hasheada
                const [result] = await connection.execute(
                    `INSERT INTO usuario (nombre, cedula, telefono, correo, contrasena, estado) VALUES (?, ?, ?, ?, ?, ?)`,
                    [nombre, cedula, telefono, correo, hashedPassword, true]
                );
                fk_id_usuario = result.insertId;
                console.log(`Nuevo usuario registrado automáticamente con ID: ${fk_id_usuario}`);

                // Asignar rol 'cliente'
                const [clienteRole] = await connection.execute(`SELECT id_rol FROM rol WHERE nombre = 'cliente'`);
                if (clienteRole.length > 0) {
                    await connection.execute(`INSERT INTO usuario_rol (fk_id_usuario, id_rol) VALUES (?, ?)`, [fk_id_usuario, clienteRole[0].id_rol]);
                    console.log(`Rol 'cliente' asignado al nuevo usuario ID: ${fk_id_usuario}`);
                }

                // Enviar correo de bienvenida con la contraseña en texto plano
                const correoEnviado = await enviarCorreoBienvenida(correo, contrasenaGenerada);
                if (correoEnviado) {
                    console.log(`Correo de bienvenida con contraseña enviado a ${correo}`);
                } else {
                    console.warn(`Falló el envío del correo de bienvenida a ${correo}.`);
                }
            }
        }

        if (!carritoDesdeDB || carritoDesdeDB.length === 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, mensaje: 'No se encontraron artículos en su carrito para procesar.' });
        }

        // 3. Crear o Actualizar la Factura
        let id_factura;
        const [existingFacturas] = await connection.execute(
            `SELECT id_factura FROM factura 
             WHERE fk_id_usuario = ? AND estado_pedido = 'Pendiente' AND fecha_venta >= NOW() - INTERVAL 15 MINUTE
             ORDER BY fecha_venta DESC LIMIT 1`,
            [fk_id_usuario]
        );

        if (existingFacturas.length > 0) {
            id_factura = existingFacturas[0].id_factura;
            console.log(`Factura pendiente encontrada (ID: ${id_factura}). Actualizando datos de envío.`);
            await connection.execute(
                `UPDATE factura SET direccion = ?, informacion_adicional = ?, valor_envio = ? WHERE id_factura = ?`,
                [direccion, informacion_adicional || null, 14900.00, id_factura]
            );
        } else {
            const [facturaResult] = await connection.execute(
                `INSERT INTO factura (fk_id_usuario, fecha_venta, direccion, informacion_adicional, valor_total, valor_envio, estado_pedido)
                 VALUES (?, NOW(), ?, ?, ?, ?, 'Pendiente')`,
                [fk_id_usuario, direccion, informacion_adicional || null, 0.00, 14900.00]
            );
            id_factura = facturaResult.insertId;
            console.log(`Nueva factura (ID: ${id_factura}) creada para usuario ID: ${fk_id_usuario}.`);
        }

        // 4. Poblar el carrito en la DB para usuarios nuevos o invitados
        if (!req.user || esNuevoRegistro) {
            await connection.execute(`DELETE FROM carrito_compras WHERE FK_id_usuario = ?`, [fk_id_usuario]);
            console.log(`Carrito DB limpiado para usuario ID: ${fk_id_usuario}`);

            for (const item of carritoDesdeDB) {
                await connection.execute(
                    `INSERT INTO carrito_compras (FK_id_usuario, FK_referencia_producto, FK_id_calcomania, cantidad, tamano) VALUES (?, ?, ?, ?, ?)`,
                    [fk_id_usuario, item.tipo === 'producto' ? item.id_producto : null, item.tipo === 'calcomania' ? item.id_calcomania : null, item.cantidad, item.tamano]
                );
            }
            console.log(`Carrito DB repoblado para usuario ID: ${fk_id_usuario}.`);
        }

        await connection.commit();
        console.log("DEBUG: Transacción de DireccionEnvio completada y datos guardados en DB.");

        res.status(200).json({
            success: true,
            mensaje: 'Información de envío y factura inicial procesadas. Puedes continuar con la compra.',
            id_factura_creada: id_factura,
            fk_id_usuario_para_compra: fk_id_usuario,
            nuevo_usuario_registrado: esNuevoRegistro,
        });

    } catch (error) {
        console.error('Error en la función DireccionEnvio:', error);
        if (connection) await connection.rollback();

        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('correo')) {
            return res.status(409).json({ success: false, mensaje: 'El correo electrónico ya está registrado. Si ya tiene una cuenta, inicie sesión.' });
        }
        res.status(500).json({ success: false, mensaje: 'Error interno del servidor al procesar la dirección de envío.' });
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