import { createContext, useContext } from 'react';

/** Lets any component jump to another page (e.g. click an IP → its timeline). */
export const NavContext = createContext({
  go: () => {}, openTimeline: () => {}, openAlert: () => {},
});
export const useNav = () => useContext(NavContext);
