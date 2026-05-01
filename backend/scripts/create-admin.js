// Script para crear el primer usuario administrador
const axios = require('axios');

const registerAdmin = async () => {
  try {
    console.log('🔄 Registrando usuario administrador...\n');
    
    const response = await axios.post('http://localhost:4001/api/auth/register', {
      email: 'admin@fink.com',
      password: 'Admin123!',
      firstName: 'Administrador',
      lastName: 'FINK',
      role: 'ADMIN'
    });

    console.log('✅ Usuario creado exitosamente!\n');
    console.log('📧 Email:', response.data.data.user.email);
    console.log('👤 Nombre:', response.data.data.user.firstName, response.data.data.user.lastName);
    console.log('🔑 Role:', response.data.data.user.role);
    console.log('\n🎫 Token de acceso:');
    console.log(response.data.data.token);
    console.log('\n💡 Guarda este token para hacer peticiones autenticadas.');
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Error:', error.response.data.error.message);
    } else if (error.request) {
      console.error('❌ Error: No se pudo conectar al servidor.');
      console.error('💡 Asegúrate de que el backend esté corriendo en http://localhost:4001');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
};

registerAdmin();
