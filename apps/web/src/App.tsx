import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { DirectoryPage } from "./routes/directory";

export default function App() {
  return (
    <Routes>
      <Route
        path="/directory"
        element={
          <AppShell>
            <DirectoryPage />
          </AppShell>
        }
      />
      <Route path="*" element={<Navigate to="/directory" replace />} />
    </Routes>
  );
}
