import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { DirectoryPage } from "./routes/directory";
import { PersonPage } from "./routes/person";
import { ProjectPage } from "./routes/project";
import { ProgramPage } from "./routes/program";
import { OrganizationPage } from "./routes/organization";
import { CapabilityPage, GrantPage, PublicationPage } from "./routes/detail";
import type { ReactNode } from "react";

const shell = (node: ReactNode) => <AppShell>{node}</AppShell>;

export default function App() {
  return (
    <Routes>
      <Route path="/directory" element={shell(<DirectoryPage />)} />
      <Route path="/people/:id" element={shell(<PersonPage />)} />
      <Route path="/projects/:id" element={shell(<ProjectPage />)} />
      <Route path="/programs/:id" element={shell(<ProgramPage />)} />
      <Route path="/organizations/:id" element={shell(<OrganizationPage />)} />
      <Route path="/publications/:id" element={shell(<PublicationPage />)} />
      <Route path="/grants/:id" element={shell(<GrantPage />)} />
      <Route path="/capabilities/:id" element={shell(<CapabilityPage />)} />
      <Route path="*" element={<Navigate to="/directory" replace />} />
    </Routes>
  );
}
