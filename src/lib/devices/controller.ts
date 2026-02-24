import type { Command } from "@/types/command";

// ─── Device Result ──────────────────────────────────────────

export interface DeviceResult {
  device: string;
  status: "dispatched" | "skipped";
  message: string;
}

// ─── Mock Device APIs ───────────────────────────────────────

function vacuumRobot(command: Command): DeviceResult {
  const message = `Moving to ${command.location} to perform ${command.action}`;
  console.log(`[VacuumRobot] ${message}`);
  return { device: "VacuumRobot", status: "dispatched", message };
}

function uberEats(_command: Command): DeviceResult {
  console.log(`[UberEats] Order initiated — searching restaurants matching family dietary constraints`);
  return {
    device: "UberEats",
    status: "dispatched",
    message: "Uber Eats order initiated — searching restaurants matching family dietary constraints",
  };
}

// ─── Action → Device Map ────────────────────────────────────

const ACTION_DEVICE_MAP: Record<string, (cmd: Command) => DeviceResult> = {
  CLEAN: vacuumRobot,
  COOK: uberEats,
  BUY: uberEats,
};

// ─── Controller ─────────────────────────────────────────────

export function dispatch(command: Command): DeviceResult {
  const handler = ACTION_DEVICE_MAP[command.action];

  if (!handler) {
    const message = `No device registered for action "${command.action}"`;
    console.log(`[Controller] ${message}`);
    return { device: "none", status: "skipped", message };
  }

  return handler(command);
}
