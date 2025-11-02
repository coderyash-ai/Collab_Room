# 🔗 VS Code Integration Setup Guide

This guide will walk you through connecting VS Code with your Collab Room for real-time collaborative development.

## 📦 **Step 1: Install the VS Code Extension**

### Option A: Install from Local Package (Development)

1. **Install the packaged extension:**
   ```bash
   code --install-extension vscode-extension/collab-room-vscode-1.0.0.vsix
   ```

2. **Or install manually:**
   - Open VS Code
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
   - Type "Install from VSIX"
   - Select the `collab-room-vscode-1.0.0.vsix` file from the `vscode-extension` folder

### Option B: Development Mode (For Testing)

1. **Open the extension in VS Code:**
   ```bash
   code vscode-extension/
   ```

2. **Run in development:**
   - Press `F5` to launch a new VS Code window with the extension loaded
   - This opens a new "Extension Development Host" window

## 🚀 **Step 2: Start Your Collab Room Server**

1. **Start the backend server:**
   ```bash
   npm run dev:backend
   ```
   Server will run on `http://localhost:5000`

2. **Start the frontend (in another terminal):**
   ```bash
   npm run dev:frontend  
   ```
   Frontend will run on `http://localhost:3000`

## 🔧 **Step 3: Configure VS Code Extension**

1. **Open VS Code settings:**
   - Press `Ctrl+,` (or `Cmd+,` on macOS)
   - Search for "Collab Room"

2. **Set the server URL:**
   ```json
   {
     "collabRoom.serverUrl": "http://localhost:5000",
     "collabRoom.autoSync": true,
     "collabRoom.syncInterval": 5000,
     "collabRoom.showNotifications": true
   }
   ```

## 🏠 **Step 4: Create and Join a Room**

1. **Create a room on the web interface:**
   - Go to `http://localhost:3000`
   - Login (use OAuth or demo login)
   - Create a new room
   - Note the **Room ID**

2. **Connect VS Code to the room:**
   - Press `Ctrl+Shift+P` in VS Code
   - Type "Collab Room: Connect"
   - Enter your credentials
   - Type "Collab Room: Join Room"
   - Enter the Room ID from step 1

## 📂 **Step 5: Set Up Your Project**

1. **Open a project folder in VS Code:**
   ```bash
   mkdir my-collab-project
   cd my-collab-project
   code .
   ```

2. **Create some files:**
   ```bash
   # Create a sample project
   echo 'console.log("Hello Collab Room!");' > index.js
   echo '# My Collaborative Project' > README.md
   ```

3. **Sync with Collab Room:**
   - Press `Ctrl+Shift+P`
   - Type "Collab Room: Sync Files"
   - Your files will sync to the platform!

## 🎯 **Step 6: Start Collaborating!**

### **Real-time File Sync**
- Edit files in VS Code - changes sync automatically
- See team members' changes in real-time
- Conflict resolution handled automatically

### **Team Commands**
- Press `Ctrl+Shift+P` → "Collab Room: Run Team Command"
- Execute `npm install`, `npm run build`, etc. across the team
- See shared command output

### **Deployment**
- Press `Ctrl+Shift+P` → "Collab Room: Deploy"
- Choose platform (Vercel, Netlify, Docker)
- Deploy collaboratively with the team

### **Git Integration**
- `Ctrl+Shift+P` → "Collab Room: Git Status"
- `Ctrl+Shift+P` → "Collab Room: Git Commit"
- Collaborative git operations with team visibility

## 🎮 **Available Commands**

| Command | Description |
|---------|-------------|
| `Collab Room: Connect` | Connect to the platform |
| `Collab Room: Disconnect` | Disconnect from platform |
| `Collab Room: Join Room` | Join a collaboration room |
| `Collab Room: Sync Files` | Manually sync workspace files |
| `Collab Room: Pull Files` | Pull latest files from team |
| `Collab Room: Run Team Command` | Execute commands across team |
| `Collab Room: Deploy` | Deploy project to cloud |
| `Collab Room: Show Panel` | Show collaboration panel |
| `Collab Room: Git Status` | Check git status |
| `Collab Room: Git Commit` | Make collaborative commit |
| `Collab Room: Git Push` | Push to remote repository |
| `Collab Room: Git Pull` | Pull from remote repository |

## 🔍 **VS Code Interface Features**

### **Collab Room Panel**
- Click the Collab Room icon in the Activity Bar (left side)
- See connected team members
- View project files and sync status
- Monitor deployments

### **Status Bar**
- Shows connection status at the bottom
- Click to open Collab Room panel
- Green = Connected, Orange = Disconnected

### **Notifications**
- Real-time notifications for team activities
- File sync status updates
- Deployment progress and results

## 🛠️ **Troubleshooting**

### **Extension Not Loading**
```bash
# Reload VS Code window
Ctrl+Shift+P → "Developer: Reload Window"

# Check extension is installed
Ctrl+Shift+P → "Extensions: Show Installed Extensions"
# Look for "Collab Room - Collaborative Development"
```

### **Connection Issues**
1. **Check server is running:**
   ```bash
   curl http://localhost:5000/health
   ```

2. **Verify settings:**
   ```json
   {
     "collabRoom.serverUrl": "http://localhost:5000"
   }
   ```

3. **Check authentication:**
   - Disconnect and reconnect
   - Clear saved credentials: `Ctrl+Shift+P` → "Collab Room: Disconnect"

### **File Sync Issues**
1. **Manual sync:**
   - `Ctrl+Shift+P` → "Collab Room: Sync Files"

2. **Check ignored files:**
   - Extension automatically ignores `node_modules`, `.git`, etc.
   - Check console for sync errors

3. **Restart extension:**
   - `Ctrl+Shift+P` → "Developer: Reload Window"

## 🌟 **Pro Tips**

### **1. Team Workflow**
```bash
# Team Leader Setup
1. Create room on web interface
2. Share Room ID with team
3. Create initial project structure
4. Sync files: Ctrl+Shift+P → "Collab Room: Sync Files"

# Team Member Setup  
1. Install VS Code extension
2. Connect: Ctrl+Shift+P → "Collab Room: Connect"
3. Join room: Ctrl+Shift+P → "Collab Room: Join Room"
4. Pull files: Ctrl+Shift+P → "Collab Room: Pull Files"
```

### **2. Deployment Workflow**
```bash
# Set up deployment
1. Configure build command (npm run build)
2. Set output directory (dist, build)
3. Add environment variables
4. Deploy: Ctrl+Shift+P → "Collab Room: Deploy"
```

### **3. Git Workflow**
```bash
# Collaborative git
1. Make changes in VS Code
2. Sync files automatically
3. Collaborative commit: Ctrl+Shift+P → "Collab Room: Git Commit"
4. Push together: Ctrl+Shift+P → "Collab Room: Git Push"
```

## 📱 **Multi-IDE Support (Coming Soon)**

- **IntelliJ IDEA** - Plugin in development
- **WebStorm** - TypeScript/JavaScript focus
- **Sublime Text** - Lightweight integration
- **Vim/Neovim** - Terminal-based plugin

## 🔐 **Security Notes**

- All communication encrypted via WebSocket
- JWT token-based authentication
- Files synced securely with conflict resolution
- Command execution uses whitelist for security

## 📞 **Need Help?**

1. **Check the logs:**
   - View → Output → Select "Collab Room" from dropdown

2. **Report issues:**
   - GitHub Issues: `github.com/your-org/collab-room/issues`

3. **Join Discord:**
   - Community support: `discord.gg/collab-room`

---

**🎉 You're now ready to collaborate in real-time with VS Code and Collab Room!**

Start by creating a room on the web interface, then connect your VS Code and invite your team members to join the collaborative coding experience.