unit %PROJECT_NAME%unit;
{$mode objfpc}{$H+}

interface

procedure SayHello(const AName: string);

implementation

uses
  SysUtils;

procedure SayHello(const AName: string);
begin
  WriteLn('Hello, ', AName, '! Welcome to %PROJECT_NAME%.');
end;

end.
