import { Redirect, Route, Switch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "@/lib/api";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import Book from "@/pages/Book";
import History from "@/pages/History";
import OfficeInfo from "@/pages/OfficeInfo";
import ReportPage from "@/pages/Report";
import Inbox from "@/pages/Inbox";
import Tags from "@/pages/Tags";
import Clients from "@/pages/Clients";
import Announcements from "@/pages/Announcements";
import Board from "@/pages/Board";

function Authed() {
  const { data: me, isLoading, isError } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  if (isLoading) return null;
  if (isError || !me) return <Redirect to="/login" />;
  return (
    <AppShell me={me}>
      <Switch>
        <Route path="/app"><Overview me={me} /></Route>
        <Route path="/app/book" component={Book} />
        <Route path="/app/history" component={History} />
        <Route path="/app/office" component={OfficeInfo} />
        <Route path="/app/report" component={ReportPage} />
        <Route path="/app/announcements"><Announcements me={me} /></Route>
        <Route path="/app/board" component={Board} />
        {me.role === "manager" && <Route path="/app/inbox" component={Inbox} />}
        {me.role === "manager" && <Route path="/app/tags" component={Tags} />}
        {me.role === "manager" && <Route path="/app/clients" component={Clients} />}
        <Route><Redirect to="/app" /></Route>
      </Switch>
    </AppShell>
  );
}

export default function App() {
  const [loc] = useLocation();
  if (loc === "/app" || loc.startsWith("/app/")) return <Authed />;
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route><Redirect to="/app" /></Route>
    </Switch>
  );
}
