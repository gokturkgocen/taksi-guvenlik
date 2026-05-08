"""MATCH sinyalini STM32'ye gonder (USB-serial) + cooldown.

Cikti formati (UTF-8, satirla sonlanir):
    MATCH:<name>;<sim>\n

STM32 UART1 (9600 8N1) dinler, parse eder, UART2 uzerinden HM-10 BLE
modulune aktarir. HM-10 BLE uzerinden Android'e gider, Android uygulamasi
Intent.ACTION_CALL ile test numarasini arar.

Serial port yoksa / acilamazsa konsola yazdirir (debug).
"""
from __future__ import annotations

import time
from typing import Any


class MatchEmitter:
    def __init__(self, port: str | None = None, baud: int = 9600,
                 cooldown_s: float = 10.0, verbose: bool = True):
        self.port = port
        self.baud = baud
        self.cooldown_s = cooldown_s
        self.verbose = verbose
        self.serial = None
        self._last_emit: dict[str, float] = {}

        if port:
            try:
                import serial  # pyserial
                self.serial = serial.Serial(port, baud, timeout=0.1)
                if verbose:
                    print(f"[emitter] Serial acildi: {port} @ {baud}")
            except Exception as e:
                print(f"[emitter] Serial acilamadi ({port}): {e}. "
                      "Konsol moduna dusuldu.")
                self.serial = None
        else:
            if verbose:
                print("[emitter] Serial port tanimlanmadi, konsol modu.")

    def emit(self, name: str, sim: float, meta: dict[str, Any] | None = None) -> bool:
        """Ayni kisi icin cooldown icindeyse False doner, emit etmez."""
        now = time.time()
        last = self._last_emit.get(name, 0.0)
        if now - last < self.cooldown_s:
            return False

        msg = f"MATCH:{name};{sim:.3f}\n"
        if self.serial is not None:
            try:
                self.serial.write(msg.encode("utf-8"))
                self.serial.flush()
            except Exception as e:
                print(f"[emitter] Serial write hatasi: {e}")

        if self.verbose:
            meta_str = f"  meta={meta}" if meta else ""
            print(f"[EMIT] {msg.strip()}{meta_str}")

        self._last_emit[name] = now
        return True

    def close(self) -> None:
        if self.serial is not None:
            try:
                self.serial.close()
            except Exception:
                pass
