import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import NotFound from "@/pages/not-found";

// Staff Pages
import StaffDashboard from "@/pages/StaffDashboard";
import Rooms from "@/pages/Rooms";
import Inventory from "@/pages/Inventory";
import Maintenance from "@/pages/Maintenance";
import Suggestions from "@/pages/Suggestions";

// Admin Pages
import AdminRooms from "@/pages/AdminRooms";
import AdminInventory from "@/pages/AdminInventory";
import AdminMaintenance from "@/pages/AdminMaintenance";
import AdminVendors from "@/pages/AdminVendors";
import AdminScheduled from "@/pages/AdminScheduled";
import AdminSettings from "@/pages/AdminSettings";

import { useAppState } from "@/hooks/use-app-state";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AdminRoute({ component: Component, ...rest }: any) {
  const { isAdmin } = useAppState();
  if (!isAdmin) return <Redirect to="/rooms" />;
  return <Component {...rest} />;
}

function Router() {
  const { isAdmin } = useAppState();

  return (
    <Layout>
      <Switch>
        {/* Redirect root */}
        <Route path="/">
          {() => <Redirect to={isAdmin ? "/admin/rooms" : "/dashboard"} />}
        </Route>

        {/* Staff: single-page dashboard */}
        <Route path="/dashboard" component={StaffDashboard} />

        {/* Legacy individual staff routes still accessible */}
        <Route path="/rooms" component={Rooms} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/maintenance" component={Maintenance} />
        <Route path="/suggestions" component={Suggestions} />

        {/* Admin Routes */}
        <Route path="/admin/rooms"><AdminRoute component={AdminRooms} /></Route>
        <Route path="/admin/inventory"><AdminRoute component={AdminInventory} /></Route>
        <Route path="/admin/maintenance"><AdminRoute component={AdminMaintenance} /></Route>
        <Route path="/admin/vendors"><AdminRoute component={AdminVendors} /></Route>
        <Route path="/admin/scheduled"><AdminRoute component={AdminScheduled} /></Route>
        <Route path="/admin/settings"><AdminRoute component={AdminSettings} /></Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
