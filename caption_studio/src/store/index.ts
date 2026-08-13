import { create } from "zustand";

type Project = {
  id: string;
  name: string;
  tags?: { id: string; text: string }[];
};

type StoreState = {
  user: { username: string; email: string } | null;
  projects: Project[];
  selectedProject: Project | null;
};

export const useStore = create<StoreState>(() => ({
  user: null,
  projects: [],
  selectedProject: null,
}));
