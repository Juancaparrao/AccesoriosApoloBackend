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

        const {
            nombre,
            cedula,
            telefono,
            correo,
            direccion,
            informacion_adicional,
            carrito
        } = req.body;

        if (!nombre || !cedula || !telefono || !correo || !direccion) {
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

        if (req.user && req.user.id_usuario) {
            fk_id_usuario = req.user.id_usuario;
            const [dbCartItems] = await connection.execute(
                `SELECT cc.FK_referencia_producto AS id_producto, cc.FK_id_calcomania AS id_calcomania, cc.cantidad, cc.tamano,
                        CASE WHEN cc.FK_referencia_producto IS NOT NULL THEN 'producto'
                             WHEN cc.FK_id_calcomania IS NOT NULL THEN 'calcomania' END AS tipo
                 FROM carrito_compras cc WHERE cc.FK_id_usuario = ?`,
                [fk_id_usuario]
            );
            carritoDesdeDB = dbCartItems;
        } else {
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
                fk_id_usuario = existingUserByEmail[0].id_usuario;
            } else {
                esNuevoRegistro = true;
                contrasenaGenerada = generarContrasenaSegura();
                const hashedPassword = await bcrypt.hash(contrasenaGenerada, 10);

                const [result] = await connection.execute(
                    `INSERT INTO usuario (nombre, cedula, telefono, correo, contrasena, estado) VALUES (?, ?, ?, ?, ?, ?)`,
                    [nombre, cedula, telefono, correo, hashedPassword, true]
                );
                fk_id_usuario = result.insertId;

                const [clienteRole] = await connection.execute(`SELECT id_rol FROM rol WHERE nombre = 'cliente'`);
                if (clienteRole.length > 0) {
                    await connection.execute(`INSERT INTO usuario_rol (fk_id_usuario, id_rol) VALUES (?, ?)`, [fk_id_usuario, clienteRole[0].id_rol]);
                }

                await enviarCorreoBienvenida(correo, contrasenaGenerada);
            }
        }

        if (!carritoDesdeDB || carritoDesdeDB.length === 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, mensaje: 'No se encontraron artículos en su carrito para procesar.' });
        }

        if (!req.user || esNuevoRegistro) {
            await connection.execute(`DELETE FROM carrito_compras WHERE FK_id_usuario = ?`, [fk_id_usuario]);

            for (const item of carritoDesdeDB) {
                await connection.execute(
                    `INSERT INTO carrito_compras (FK_id_usuario, FK_referencia_producto, FK_id_calcomania, cantidad, tamano)
                     VALUES (?, ?, ?, ?, ?)`,
                    [fk_id_usuario, item.tipo === 'producto' ? item.id_producto : null,
                                   item.tipo === 'calcomania' ? item.id_calcomania : null,
                                   item.cantidad, item.tamano]
                );
            }
        }

        let id_factura;
        const [existingFacturas] = await connection.execute(
            `SELECT id_factura FROM factura
             WHERE fk_id_usuario = ? AND estado_pedido = 'Pendiente' AND fecha_venta >= NOW() - INTERVAL 15 MINUTE
             ORDER BY fecha_venta DESC LIMIT 1`,
            [fk_id_usuario]
        );

        if (existingFacturas.length > 0) {
            id_factura = existingFacturas[0].id_factura;
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
        }

        // ✅ Consulta corregida con precio_unidad y multiplicador por tamaño
        const [totalResult] = await connection.execute(`
          SELECT
            COALESCE(SUM(
              CASE 
                WHEN cc.FK_referencia_producto IS NOT NULL THEN 
                  CASE 
                    WHEN p.precio_descuento IS NOT NULL AND p.precio_descuento != p.precio_unidad
                      THEN p.precio_descuento
                      ELSE p.precio_unidad
                  END * cc.cantidad
                ELSE 0
              END
            ), 0) +
            COALESCE(SUM(
              CASE 
                WHEN cc.FK_id_calcomania IS NOT NULL THEN 
                  COALESCE(cal.precio_descuento, cal.precio_unidad) * 
                  CASE 
                    WHEN LOWER(cc.tamano) = 'pequeño' THEN 1.0
                    WHEN LOWER(cc.tamano) = 'mediano' THEN 2.25
                    WHEN LOWER(cc.tamano) = 'grande' THEN 4.0
                    ELSE 1.0
                  END * cc.cantidad
                ELSE 0
              END
            ), 0) AS total_carrito
          FROM carrito_compras cc
          LEFT JOIN producto p ON cc.FK_referencia_producto = p.referencia
          LEFT JOIN calcomania cal ON cc.FK_id_calcomania = cal.id_calcomania
          WHERE cc.FK_id_usuario = ?
        `, [fk_id_usuario]);

        const totalCarrito = parseFloat(totalResult[0].total_carrito || 0);
        const valorEnvio = 14900;
        const totalFinal = totalCarrito + valorEnvio;

        await connection.execute(
            `UPDATE factura SET valor_total = ? WHERE id_factura = ?`,
            [totalFinal, id_factura]
        );

        await connection.commit();

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
