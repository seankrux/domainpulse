// vitest.config.ts
import { defineConfig } from "file:///Users/sean/Documents/Git/Sean%20M/Tools/domainpulse/node_modules/vitest/dist/config.js";
import react from "file:///Users/sean/Documents/Git/Sean%20M/Tools/domainpulse/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "/Users/sean/Documents/Git/Sean M/Tools/domainpulse";
var vitest_config_default = defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.spec.ts", "tests/**/*.test.ts"],
    exclude: ["tests/**/*.gui.spec.ts", "node_modules", "dist", "dist-site"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", "dist-site", "tests", "*.config.ts"]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, ".")
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy9zZWFuL0RvY3VtZW50cy9HaXQvU2VhbiBNL1Rvb2xzL2RvbWFpbnB1bHNlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvc2Vhbi9Eb2N1bWVudHMvR2l0L1NlYW4gTS9Ub29scy9kb21haW5wdWxzZS92aXRlc3QuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9zZWFuL0RvY3VtZW50cy9HaXQvU2VhbiUyME0vVG9vbHMvZG9tYWlucHVsc2Uvdml0ZXN0LmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGVzdC9jb25maWcnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSBhcyBhbnldLFxuICB0ZXN0OiB7XG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICBzZXR1cEZpbGVzOiAnLi90ZXN0cy9zZXR1cC50cycsXG4gICAgaW5jbHVkZTogWyd0ZXN0cy8qKi8qLnNwZWMudHMnLCAndGVzdHMvKiovKi50ZXN0LnRzJ10sXG4gICAgZXhjbHVkZTogWyd0ZXN0cy8qKi8qLmd1aS5zcGVjLnRzJywgJ25vZGVfbW9kdWxlcycsICdkaXN0JywgJ2Rpc3Qtc2l0ZSddLFxuICAgIGNvdmVyYWdlOiB7XG4gICAgICBwcm92aWRlcjogJ3Y4JyxcbiAgICAgIHJlcG9ydGVyOiBbJ3RleHQnLCAnanNvbicsICdodG1sJ10sXG4gICAgICBleGNsdWRlOiBbJ25vZGVfbW9kdWxlcycsICdkaXN0JywgJ2Rpc3Qtc2l0ZScsICd0ZXN0cycsICcqLmNvbmZpZy50cyddLFxuICAgIH0sXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLicpLFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBOFUsU0FBUyxvQkFBb0I7QUFDM1csT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUZqQixJQUFNLG1DQUFtQztBQUl6QyxJQUFPLHdCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFRO0FBQUEsRUFDeEIsTUFBTTtBQUFBLElBQ0osU0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLElBQ2IsWUFBWTtBQUFBLElBQ1osU0FBUyxDQUFDLHNCQUFzQixvQkFBb0I7QUFBQSxJQUNwRCxTQUFTLENBQUMsMEJBQTBCLGdCQUFnQixRQUFRLFdBQVc7QUFBQSxJQUN2RSxVQUFVO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixVQUFVLENBQUMsUUFBUSxRQUFRLE1BQU07QUFBQSxNQUNqQyxTQUFTLENBQUMsZ0JBQWdCLFFBQVEsYUFBYSxTQUFTLGFBQWE7QUFBQSxJQUN2RTtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLEdBQUc7QUFBQSxJQUNsQztBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
