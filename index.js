const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = 3000;
const  upload  = require('./multer');
const {solicitarRecuperacion, cambiarContrasena } = require('./InicioController/RecuperarContrasena');
const { solicitarOTP, reenviarOTP, verificarOTPHandler } = require('./InicioController/OTP');
const { login } = require('./InicioController/Login');
const { obtenerNombre } = require('./InicioController/GeneralInicio');
const { verificarToken } = require('./InicioController/middleware');
const { loginConGoogle } = require('./InicioController/GoogleAuth');
const { loginConFacebook } = require('./InicioController/FacebookAuth');
const { obtenerPerfil } = require('./InicioController/Perfil');
const { validarGerente } = require('./UsuariosController/validacionesUsuarios');
const { registrarUsuarioDirecto } = require('./UsuariosController/registrarUsuarios');
const { consultarUsuarios } = require('./UsuariosController/consultarUsuarios');
const { buscarUsuarioPorCorreo } = require('./UsuariosController/BuscarUsuarioPorCorreo');
const { obtenerDatosUsuario, actualizarUsuario } = require('./UsuariosController/ActualizarUsuario');
const { eliminarUsuario } = require('./UsuariosController/EliminarUsuario');
const { reactivarUsuario } = require('./UsuariosController/ReactivarUsuario');
const { EditarPerfil } = require('./InicioController/EditarPerfil');
const { RegistrarProveedor } = require('./ProveedoresController/RegistrarProveedor');
const { ConsultarProveedor } = require('./ProveedoresController/ConsultarProveedor');
const { ReactivarProveedor } = require('./ProveedoresController/ReactivarProveedor');
const { EliminarProveedor } = require('./ProveedoresController/EliminarProveedor');
const { ObtenerDatosProveedor, ActualizarProveedor } = require('./ProveedoresController/ActualizarProveedor');
const { BuscarProveedorPorNit } = require('./ProveedoresController/BuscarProveedorPorNit');
const { RegistrarCategoria } = require('./CategoriasController/RegistrarCategoria');
const { ConsultarCategoria } = require('./CategoriasController/ConsultarCategoria');
const { EliminarCategoria } = require('./CategoriasController/EliminarCategoria');
const { ObtenerDatosCategoria, ActualizarCategoria } = require('./CategoriasController/ActualizarCategoria');
const { ReactivarCategoria } = require('./CategoriasController/ReactivarCategoria');
const { BuscarCategoriaPorNombre } = require('./CategoriasController/BuscarCategoriaPorNombre');
const { RegistrarSubcategoria } = require('./SubcategoriasController/RegistrarSubcategoria');
const { ConsultarSubcategoria } = require('./SubcategoriasController/ConsultarSubcategoria');
const { EliminarSubcategoria } = require('./SubcategoriasController/EliminarSubcategoria');
const { ReactivarSubcategoria } = require('./SubcategoriasController/ReactivarSubcategoria');
const { ActualizarSubcategoria, ObtenerDatosSubcategoria } = require('./SubcategoriasController/ActualizarSubcategoria');
const { BuscarSubcategoriaPorNombre } = require('./SubcategoriasController/BuscarSubcategoriaPorNombre');
const { RegistrarProducto, ObtenerCategorias, ObtenerSubcategoriasPorCategoria } = require('./ProductosController/RegistrarProducto');
const { ConsultarProducto } = require('./ProductosController/ConsultarProducto');
const { ActualizarProducto, ObtenerProductos } = require('./ProductosController/ActualizarProducto');
const { EliminarProducto } = require('./ProductosController/EliminarProducto');
const { ReactivarProducto } = require('./ProductosController/ReactivarProducto');
const { BuscarProductoPorReferencia } = require('./ProductosController/BuscarProductoPorReferencia');
const { ConsultarFacturasProveedor } = require('./FacturasProveedorController/ConsultarFacturasProveedor');
const { RegistrarFacturasProveedor, BuscarProductoFacturaPorReferencia } = require('.//FacturasProveedorController/RegistrarFacturasProveedor');
const { ConsultarDetalleFacturaProveedor } = require('./FacturasProveedorController/ConsultarDetalleFacturaProveedor');
const { RegistrarCalcomania } = require('./CalcomaniasController/RegistrarCalcomania');
const { ConsultarCalcomania } = require('./CalcomaniasController/ConsultarCalcomania');
const { ActualizarCalcomania, ObtenerDatosCalcomania } = require('./CalcomaniasController/ActualizarCalcomania'); 
const { EliminarCalcomania } = require('./CalcomaniasController/EliminarCalcomania');
const { ReactivarCalcomania } = require('./CalcomaniasController/ReactivarCalcomania');
const { BuscarCalcomaniaPorNombre } = require('./CalcomaniasController/BuscarCalcomaniaPorNombre');
const { RegistrarVenta, ValidarClientePorCedula, BuscarProductoVentaPorReferencia } = require('./VentasController/RegistrarVenta');
const { ConsultarVenta } = require('./VentasController/ConsultarVenta');

app.use(cors({
  origin: ['http://localhost:5173', 'https://accesorios-apolo-frontend.vercel.app'],
  credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Rutas de registro con OTP
app.post('/solicitar-otp', solicitarOTP);
app.post('/reenviar-otp', reenviarOTP);
app.post('/verificar-otp', verificarOTPHandler);

// Ruta de login
app.post('/login', login);

// Ruta para obtener nombre del usuario
app.post('/obtener-nombre', obtenerNombre);

// Ruta protegida con JWT
app.get('/perfil', verificarToken, obtenerPerfil);
app.put('/editar-perfil', verificarToken, EditarPerfil);


// Recuperar contraseña
app.post('/recuperar', solicitarRecuperacion);
app.post('/cambiar-contrasena', cambiarContrasena);

// Ruta de login con Google
app.post('/login-google', loginConGoogle);

// Ruta de login con Facebook
app.post('/auth/facebook', loginConFacebook);

//Validar gerente
app.get('/validar-gerente', verificarToken, validarGerente);

//Modulo de usuarios
app.post('/registrar-directo', registrarUsuarioDirecto);
app.get('/usuarios', verificarToken, consultarUsuarios);
app.get('/buscar-usuario-correo', buscarUsuarioPorCorreo);
app.post('/obtener-usuario-por-correo', obtenerDatosUsuario);
app.put('/actualizar-usuario', actualizarUsuario);
app.put('/eliminar-usuario', eliminarUsuario);
app.put('/reactivar-usuario', reactivarUsuario);

// Módulo de proveedores
app.post('/registrar-proveedor', RegistrarProveedor);
app.get('/proveedores', ConsultarProveedor);
app.put('/eliminar-proveedor', EliminarProveedor);
app.put('/reactivar-proveedor', ReactivarProveedor);
app.post('/obtener-proveedor', ObtenerDatosProveedor);
app.put('/actualizar-proveedor', ActualizarProveedor);
app.get('/buscar-proveedor', BuscarProveedorPorNit);

// Módulo de categorías
app.post('/registrar-categoria', RegistrarCategoria);
app.get('/categorias', ConsultarCategoria);
app.put('/eliminar-categoria', EliminarCategoria);
app.post('/obtener-categoria', ObtenerDatosCategoria);
app.put('/actualizar-categoria', ActualizarCategoria);
app.put('/reactivar-categoria', ReactivarCategoria);
app.get('/buscar-categoria-nombre', BuscarCategoriaPorNombre);

// Módulo de subcategorías
app.post('/registrar-subcategoria', upload.single('imagen'), RegistrarSubcategoria);
app.get('/subcategorias', ConsultarSubcategoria);
app.put('/eliminar-subcategoria', EliminarSubcategoria);
app.put('/reactivar-subcategoria', ReactivarSubcategoria);
app.post('/obtener-subcategoria', ObtenerDatosSubcategoria);
app.put('/actualizar-subcategoria', upload.single('imagen'), ActualizarSubcategoria);
app.get('/buscar-subcategoria-nombre', BuscarSubcategoriaPorNombre);

// Módulo de productos
app.post('/registrar-producto', upload.array('imagenes', 8), RegistrarProducto);
app.get('/categorias-productos', ObtenerCategorias);
app.get('/subcategorias-productos/:id_categoria', ObtenerSubcategoriasPorCategoria);
app.get('/consultar-producto', ConsultarProducto);
app.get('/obtener-productos', ObtenerProductos);
app.put('/actualizar-producto', upload.array('imagenes', 8), ActualizarProducto);
app.put('/eliminar-producto', EliminarProducto);
app.put('/reactivar-producto', ReactivarProducto);
app.get('/buscar-producto-referencia', BuscarProductoPorReferencia);

// Modulo de Facturas Proveedor
app.post('/registrar-factura-proveedor', RegistrarFacturasProveedor);
app.get('/buscar-producto-factura-referencia', BuscarProductoFacturaPorReferencia);
app.get('/facturas-proveedores', ConsultarFacturasProveedor);
app.get('/consultar-detalle-factura-proveedor/:id_factura_proveedor', ConsultarDetalleFacturaProveedor);

// Módulo de Calcomanías
app.post('/registrar-calcomania', verificarToken, upload.single('imagen'), RegistrarCalcomania);
app.get('/calcomanias', ConsultarCalcomania);
app.post('/obtener-calcomania', ObtenerDatosCalcomania);
app.put('/actualizar-calcomania', upload.single('imagen'), ActualizarCalcomania);
app.put('/eliminar-calcomania', EliminarCalcomania);
app.put('/reactivar-calcomania', ReactivarCalcomania);
app.get('/buscar-calcomania-nombre', BuscarCalcomaniaPorNombre);


//Módulo de Ventas
app.post('/registrar-venta',  RegistrarVenta);
app.get('/validar-cliente-venta', ValidarClientePorCedula);
app.get('/buscar-producto-venta-referencia', BuscarProductoVentaPorReferencia);
app.get('/Consultar-ventas', ConsultarVenta);


// Inicializar servidor
app.listen(port, () => {
  console.log(`✅ Servidor corriendo`);
});
