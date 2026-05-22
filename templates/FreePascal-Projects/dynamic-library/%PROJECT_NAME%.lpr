library %PROJECT_NAME%;
{$mode objfpc}{$H+}

uses
  SysUtils;

function AddIntegers(AValue1, AValue2: Integer): Integer; cdecl;
begin
  Result := AValue1 + AValue2;
end;

exports
  AddIntegers;

begin
end.
