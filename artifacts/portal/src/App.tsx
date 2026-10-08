import { Redirect, Route, Switch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "@/lib/api";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Rooms from "@/pages/Rooms";
import MePage from "@/pages/Me";
import Dashboard from "@/pages/Dashboard";
import Issues from "@/pages/Issues";
import Bookings from "@/pages/Bookings";
import MetricsPage from "@/pages/Metrics";
import Suppliers from "@/pages/Suppliers";
import Settings from "@/pages/Settings";
import Tags from "@/pages/Tags";
import Users from "@/pages/Users";
import Account from "@/pages/Account";
import Access from "@/pages/Access";

function Authed() {
  const { data: me, isLoading, isError } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  if (isLoading) return null;
  if (isError || !me) return <Redirect to="/login" />;
  return (
    <AppShell me={me}>
      <Switch>
        <Route path="/app"><Home me={me} /></Route>
        <Route path="/app/rooms"><Rooms me={me} /></Route>
        <Route path="/app/me"><MePage me={me} /></Route>
        <Route path="/app/account"><Account me={me} /></Route>
        {me.role === "admin" && <Route path="/app/dashboard"><Dashboard me={me} /></Route>}
        {me.role === "admin" && <Route path="/app/issues"><Issues me={me} /></Route>}
        {me.role === "admin" && <Route path="/app/bookings" component={Bookings} />}
        {me.role === "admin" && <Route path="/app/metrics" component={MetricsPage} />}
        {me.role === "admin" && <Route path="/app/suppliers" component={Suppliers} />}
        {me.role === "admin" && <Route path="/app/settings" component={Settings} />}
        <Route path="/app/inbox"><Redirect to="/app/dashboard" /></Route>
        {me.role === "admin" && <Route path="/app/tags" component={Tags} />}
        {me.role === "admin" && <Route path="/app/users" component={Users} />}
        <Route><Redirect to="/app" /></Route>
      </Switch>
    </AppShell>
  );
}

export default function App() {
  const [loc] = useLocation();
  if (loc === "/app" || loc.startsWith("/app/")) return <Authed />;
  if (loc.startsWith("/access/")) return <Access />; // the supplier's page: no sign-in, the secret link is the credential
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route><Redirect to="/app" /></Route>
    </Switch>
  );
}
